import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClock,
  ClipboardList,
  Database,
  GraduationCap,
  School,
  Timer,
  Users,
} from "lucide-react";
import { PageHeader, Panel, StatCard, EmptyState } from "@/components/admin/ui";
import { ApplicationToggle } from "@/components/admin/application-toggle";
import { YearLevelChart } from "@/components/admin/charts";
import { SetupNotice } from "@/components/site/setup-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin/auth";
import { getDefaultSurvey, getOverviewStats } from "@/lib/admin/queries";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { surveyStats } from "@/lib/survey/source";
import { formatDate, formatDateTime } from "@/lib/utils";
import { getApplicationAvailability } from "@/lib/survey/application-window-server";
import { toggleApplications } from "./surveys/actions";

export const metadata: Metadata = { title: "Overview" };

export default async function AdminOverviewPage() {
  const session = await requireAdmin();

  if (!isSupabaseConfigured()) {
    return (
      <>
        <PageHeader eyebrow="Dashboard" title="Overview" />
        <SetupNotice context="read" />
      </>
    );
  }

  const survey = await getDefaultSurvey();

  if (!survey) {
    return (
      <>
        <PageHeader eyebrow="Dashboard" title="Overview" />
        <Panel title="No survey found" bodyClassName="p-0">
          <EmptyState
            icon={<Database className="size-5" />}
            title="The survey has not been seeded yet"
            description="Run the migrations in supabase/migrations (0001 to 0005) against your Supabase project to create and seed the baseline survey."
          />
        </Panel>
      </>
    );
  }

  const applicationAvailability = await getApplicationAvailability();
  const stats = await getOverviewStats(survey.id);
  const hasResponses = stats.totalResponses > 0;

  const completionPercent =
    stats.expectedCells > 0
      ? Math.round((stats.answeredCells / stats.expectedCells) * 100)
      : 0;

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Overview"
        description={survey.title}
        actions={
          <>
            <Badge
              variant={applicationAvailability === "open" ? "success" : "neutral"}
              size="lg"
            >
              {applicationAvailability === "open"
                ? "Accepting applications"
                : applicationAvailability === "upcoming"
                  ? "Opens soon"
                  : "Applications closed"}
            </Badge>
            {hasResponses && (
              <Button asChild variant="outline" size="md">
                <Link href="/admin/responses">View responses</Link>
              </Button>
            )}
          </>
        }
      />

      <ApplicationToggle
        surveyId={survey.id}
        isOpen={applicationAvailability === "open"}
        responseCount={stats.totalResponses}
        canManage={session.canManage}
        toggle={toggleApplications}
      />

      {applicationAvailability === "open" && (
        <div
          role="status"
          className="mb-6 rounded-2xl border border-success/25 bg-success-soft p-4 sm:p-5"
        >
          <p className="text-[1rem] font-semibold text-plp-800">Applications are open</p>
          <p className="mt-1 text-[0.875rem] text-ink-soft">
            Students can now view and submit the application.
          </p>
        </div>
      )}

      {applicationAvailability === "closed" && (
        <div
          role="status"
          className="mb-6 rounded-2xl border border-border bg-surface p-4 sm:p-5"
        >
          <p className="text-[1rem] font-semibold text-plp-800">Applications are closed</p>
          <p className="mt-1 text-[0.875rem] text-ink-soft">
            The application period has ended.
          </p>
        </div>
      )}

      {!hasResponses ? (
        <Panel
          title="No responses yet"
          description="Figures will appear here as students submit the baseline survey."
          bodyClassName="p-0"
        >
          <EmptyState
            icon={<ClipboardList className="size-5" />}
            title="Waiting for the first submission"
            description={`The survey is seeded and ${applicationAvailability === "open" ? "accepting applications" : applicationAvailability === "upcoming" ? "scheduled to open" : "closed"}. ${surveyStats.questionCount} questions across ${surveyStats.sectionCount} sections, with ${surveyStats.schoolCount} schools available to choose from.`}
            action={
              <Button asChild variant="outline">
                <Link href="/survey">Open the participant survey</Link>
              </Button>
            }
          />
        </Panel>
      ) : (
        <div className="space-y-6">
          {/* ---- Headline metrics ---- */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total responses"
              value={stats.totalResponses.toLocaleString()}
              sub={
                stats.lastSubmission
                  ? `Most recent ${formatDateTime(stats.lastSubmission)}`
                  : undefined
              }
              icon={<ClipboardList className="size-4" />}
              tone="brand"
            />
            <StatCard
              label="Participating students"
              value={stats.distinctStudents.toLocaleString()}
              sub={
                stats.distinctStudents === stats.totalResponses
                  ? "One response per student"
                  : `${stats.totalResponses - stats.distinctStudents} duplicate email${stats.totalResponses - stats.distinctStudents === 1 ? "" : "s"}`
              }
              icon={<Users className="size-4" />}
            />
            <StatCard
              label="Participating schools"
              value={stats.distinctSchools.toLocaleString()}
              sub={`of ${stats.totalSchools} schools on the list`}
              icon={<School className="size-4" />}
            />
            <StatCard
              label="Answer completion"
              value={`${completionPercent}%`}
              sub={`${stats.answeredCells.toLocaleString()} of ${stats.expectedCells.toLocaleString()} possible answers`}
              icon={<GraduationCap className="size-4" />}
              tone="accent"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* ---- Year levels ---- */}
            <Panel
              title="Year-level distribution"
              description="Responses by the year level each student selected."
            >
              <YearLevelChart data={stats.yearLevels} />
            </Panel>

            {/* ---- Completion stats ---- */}
            <Panel
              title="Completion statistics"
              description="How thoroughly the survey is being filled in."
            >
              <dl className="space-y-5">
                <StatRow
                  icon={<GraduationCap className="size-4" />}
                  label="Required answers completed"
                  value={`${completionPercent}%`}
                  note={`Every submission must answer all ${surveyStats.requiredCount} required questions before it can be accepted.`}
                />
                <StatRow
                  icon={<ClipboardList className="size-4" />}
                  label="Optional question answered"
                  value={`${stats.optionalAnswered} of ${stats.totalResponses}`}
                  note={
                    stats.totalResponses > 0
                      ? `${Math.round((stats.optionalAnswered / stats.totalResponses) * 100)}% chose to answer the optional question.`
                      : undefined
                  }
                />
                <StatRow
                  icon={<Timer className="size-4" />}
                  label="Median time to complete"
                  value={
                    stats.medianDurationSeconds === null
                      ? "Not recorded"
                      : formatDuration(stats.medianDurationSeconds)
                  }
                  note="Measured from opening the survey to submitting it."
                />
                <StatRow
                  icon={<CalendarClock className="size-4" />}
                  label="Collection window"
                  value={
                    stats.firstSubmission && stats.lastSubmission
                      ? `${formatDate(stats.firstSubmission)} — ${formatDate(stats.lastSubmission)}`
                      : "—"
                  }
                />
              </dl>
            </Panel>
          </div>

          {/* ---- Recent submissions ---- */}
          <Panel
            title="Recent submissions"
            description="The latest responses received."
            bodyClassName="p-0"
            actions={
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/responses">See all</Link>
              </Button>
            }
          >
            <div className="overflow-x-panel">
              <table className="w-full min-w-[38rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border bg-paper/50">
                    <Th>Student</Th>
                    <Th>School</Th>
                    <Th>Year</Th>
                    <Th align="right">Submitted</Th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border/60 transition-colors last:border-0 hover:bg-plp-50/40"
                    >
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/admin/responses/${row.id}`}
                          className="text-[0.875rem] font-medium text-plp-700 underline-offset-4 hover:underline"
                        >
                          {row.full_name}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-[0.875rem] text-ink-soft">
                        {row.school_name}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant="neutral" size="sm">
                          {row.year_level}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right text-[0.8125rem] tabular-nums text-ink-muted">
                        {formatDateTime(row.submitted_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`px-5 py-3 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-muted ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function StatRow({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex gap-3.5">
      <span
        aria-hidden="true"
        className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-plp-50 text-plp-600"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <dt className="text-[0.875rem] text-ink-soft">{label}</dt>
          <dd className="font-display text-[0.9375rem] font-semibold tabular-nums text-plp-800">
            {value}
          </dd>
        </div>
        {note && <p className="mt-1 text-[0.75rem] leading-relaxed text-ink-faint">{note}</p>}
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest}s`;
}
