import type { Metadata } from "next";
import { BarChart3, Info } from "lucide-react";
import { PageHeader, Panel, StatCard, EmptyState, ScaleMeter } from "@/components/admin/ui";
import { DistributionBars, SectionMeanChart } from "@/components/admin/charts";
import { SetupNotice } from "@/components/site/setup-notice";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/admin/auth";
import { getAnalytics, getDefaultSurvey, getOverviewStats } from "@/lib/admin/queries";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { scaleOptions } from "@/lib/survey/source";
import { SCALE_MAX, formatMean, scaleShortLabel } from "@/lib/survey/scale";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  await requireAdmin();

  if (!isSupabaseConfigured()) {
    return (
      <>
        <PageHeader eyebrow="Dashboard" title="Analytics" />
        <SetupNotice context="read" />
      </>
    );
  }

  const survey = await getDefaultSurvey();
  if (!survey) {
    return (
      <>
        <PageHeader eyebrow="Dashboard" title="Analytics" />
        <Panel title="No survey found" bodyClassName="p-0">
          <EmptyState
            title="The survey has not been seeded yet"
            description="Run the migrations in supabase/migrations against your Supabase project first."
          />
        </Panel>
      </>
    );
  }

  const [analytics, overview] = await Promise.all([
    getAnalytics(survey.id),
    getOverviewStats(survey.id),
  ]);

  if (overview.totalResponses === 0 || analytics.totalScaleAnswers === 0) {
    return (
      <>
        <PageHeader eyebrow="Dashboard" title="Analytics" description={survey.title} />
        <Panel title="Nothing to analyse yet" bodyClassName="p-0">
          <EmptyState
            icon={<BarChart3 className="size-5" />}
            title="No rating answers have been submitted"
            description="Averages and distributions appear here once students begin submitting the baseline survey. No figures are estimated or simulated."
          />
        </Panel>
      </>
    );
  }

  /* Sections that carry rating answers, in original order. */
  const ratedSections = analytics.sections
    .filter((s) => s.mean !== null)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const sectionChartData = ratedSections.map((s) => ({
    label: s.shortLabel,
    fullLabel: s.plainTitle,
    mean: Number(s.mean!.toFixed(2)),
    n: s.responses,
  }));

  const sectionDistribution = ratedSections.map((section) => {
    // Sum the per-question distributions inside this section.
    const questions = analytics.questions.filter((q) => q.sectionId === section.id);
    const segments = scaleOptions.map((option, i) => ({
      option,
      label: scaleShortLabel(option),
      descriptor: option,
      count: questions.reduce(
        (sum, q) => sum + (q.distribution[i]?.count ?? 0),
        0,
      ),
    }));
    return {
      key: section.id,
      label: section.plainTitle,
      sublabel: section.title,
      total: segments.reduce((sum, s) => sum + s.count, 0),
      segments,
    };
  });

  const overallMean =
    ratedSections.length > 0
      ? ratedSections.reduce((sum, s) => sum + s.mean! * s.responses, 0) /
        ratedSections.reduce((sum, s) => sum + s.responses, 0)
      : null;

  const sortedQuestions = [...analytics.questions]
    .filter((q) => q.mean !== null)
    .sort((a, b) => a.mean! - b.mean!);

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Analytics"
        description={`Rating averages for ${survey.title}.`}
        actions={<Badge variant="neutral" size="lg">{overview.totalResponses} responses</Badge>}
      />

      {/* ---- How the numbers are produced ---- */}
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 shadow-subtle sm:p-5">
        <Info className="mt-0.5 size-[1.125rem] shrink-0 text-plp-600" aria-hidden="true" />
        <p className="text-[0.8125rem] leading-relaxed text-ink-muted">
          Averages are calculated from each answer&apos;s position in the original option
          ordering, where <strong className="font-medium text-ink-soft">1</strong> is{" "}
          <em>{scaleOptions[0]}</em> and{" "}
          <strong className="font-medium text-ink-soft">{SCALE_MAX}</strong> is{" "}
          <em>{scaleOptions[SCALE_MAX - 1]}</em>. The database always stores the exact
          original answer text — these numbers are derived for analysis only.
        </p>
      </div>

      <div className="space-y-6">
        {/* ---- Headline means ---- */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Overall mean"
            value={formatMean(overallMean)}
            sub={`across all rating questions, out of ${SCALE_MAX}`}
            tone="brand"
          />
          {ratedSections.slice(0, 3).map((section) => (
            <StatCard
              key={section.id}
              label={`Section ${section.shortLabel}`}
              value={formatMean(section.mean)}
              sub={section.plainTitle}
            />
          ))}
        </div>

        {/* ---- Section means ---- */}
        <Panel
          title="Average rating by section"
          description={`Plotted on the full 1–${SCALE_MAX} scale, so bar lengths are directly comparable.`}
        >
          <SectionMeanChart data={sectionChartData} scaleMax={SCALE_MAX} />
        </Panel>

        {/* ---- Per-section detail with named sections ---- */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel
            title="Section averages in full"
            description="Each section with its exact original title."
          >
            <ul className="space-y-5">
              {ratedSections.map((section) => (
                <li key={section.id}>
                  <ScaleMeter
                    mean={section.mean}
                    max={SCALE_MAX}
                    label={section.title}
                    count={section.responses}
                  />
                </li>
              ))}
            </ul>
          </Panel>

          <Panel
            title="Answer spread by section"
            description="How answers are distributed across the five points."
          >
            <DistributionBars rows={sectionDistribution} optionLabels={scaleOptions} />
          </Panel>
        </div>

        {/* ---- Per-question means, grouped by section ---- */}
        {ratedSections.map((section) => {
          const questions = analytics.questions
            .filter((q) => q.sectionId === section.id && q.mean !== null)
            .sort((a, b) => a.orderIndex - b.orderIndex);

          if (questions.length === 0) return null;

          return (
            <Panel
              key={section.id}
              title={section.title}
              description={`Mean rating per question, out of ${SCALE_MAX}.`}
              actions={
                <Badge variant="brand" size="sm">
                  Section mean {formatMean(section.mean)}
                </Badge>
              }
            >
              <ul className="space-y-5">
                {questions.map((question) => (
                  <li key={question.entryId}>
                    <ScaleMeter
                      mean={question.mean}
                      max={SCALE_MAX}
                      label={question.title}
                      count={question.responses}
                    />
                  </li>
                ))}
              </ul>
            </Panel>
          );
        })}

        {/* ---- Lowest-scoring questions: where the programme can help most ---- */}
        <Panel
          title="Lowest starting confidence"
          description="The rating questions with the lowest baseline averages — the clearest opportunities for the programme."
        >
          <ul className="space-y-5">
            {sortedQuestions.slice(0, 6).map((question) => (
              <li key={question.entryId}>
                <ScaleMeter
                  mean={question.mean}
                  max={SCALE_MAX}
                  label={question.title}
                  count={question.responses}
                />
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
