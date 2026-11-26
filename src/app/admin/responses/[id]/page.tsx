import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Mail, School, Timer, UserRound } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/ui";
import { SetupNotice } from "@/components/site/setup-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin/auth";
import { getResponseDetail } from "@/lib/admin/queries";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Response" };

export default async function ResponseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <>
        <PageHeader eyebrow="Dashboard" title="Response" />
        <SetupNotice context="read" />
      </>
    );
  }

  const detail = await getResponseDetail(id);
  if (!detail) notFound();

  const { response, survey, sections, items } = detail;

  // Group answers by section, preserving the original question order.
  const sectionById = new Map(sections.map((s) => [s.id, s]));
  const participantItems = items.filter((i) => i.question.section_id === null);

  const grouped = sections
    .slice()
    .sort((a, b) => a.order_index - b.order_index)
    .map((section) => ({
      section,
      items: items
        .filter((i) => i.question.section_id === section.id)
        .sort((a, b) => a.question.order_index - b.question.order_index),
    }));

  const answeredCount = items.filter((i) => i.answer !== null).length;

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-5 -ml-2">
        <Link href="/admin/responses">
          <ArrowLeft aria-hidden="true" />
          Back to responses
        </Link>
      </Button>

      <PageHeader
        eyebrow="Submission"
        title={response.full_name}
        description={survey?.title}
        actions={
          <Badge variant="neutral" size="lg">
            {answeredCount} of {items.length} answered
          </Badge>
        }
      />

      {/* ---- Participant summary ---- */}
      <div className="card-lux mb-6 grid gap-5 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
        <Meta
          icon={<Mail className="size-4" aria-hidden="true" />}
          label="Email"
          value={response.email}
        />
        <Meta
          icon={<School className="size-4" aria-hidden="true" />}
          label="School"
          value={response.school_name}
        />
        <Meta
          icon={<UserRound className="size-4" aria-hidden="true" />}
          label="Year level"
          value={response.year_level}
        />
        <Meta
          icon={<CalendarClock className="size-4" aria-hidden="true" />}
          label="Submitted"
          value={formatDateTime(response.submitted_at)}
        />
        {response.duration_seconds !== null && (
          <Meta
            icon={<Timer className="size-4" aria-hidden="true" />}
            label="Time taken"
            value={formatDuration(response.duration_seconds)}
          />
        )}
      </div>

      <div className="space-y-6">
        {/* ---- Participant detail questions ---- */}
        {participantItems.length > 0 && (
          <Panel
            title="Your details"
            description="The questions that precede the first section in the original form."
            bodyClassName="p-0"
          >
            <AnswerList items={participantItems} />
          </Panel>
        )}

        {/* ---- One panel per original section ---- */}
        {grouped.map(({ section, items: sectionItems }) => (
          <Panel
            key={section.id}
            /* Exact original section title */
            title={section.title}
            description={section.description ?? undefined}
            bodyClassName="p-0"
          >
            <AnswerList items={sectionItems} />
          </Panel>
        ))}
      </div>

      <p className="mt-8 text-[0.75rem] leading-relaxed text-ink-faint">
        Answers are shown exactly as stored. Choice answers are the original option
        strings from the source form — no numeric conversion is applied here.
        {sectionById.size === 0 && " This survey has no section blocks."}
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ */

function AnswerList({
  items,
}: {
  items: Array<{
    question: { id: string; entry_id: number; title: string; is_required: boolean };
    answer: string | null;
  }>;
}) {
  return (
    <dl className="divide-y divide-border/60">
      {items.map(({ question, answer }) => (
        <div
          key={question.id}
          className="grid gap-1.5 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-6 sm:px-6"
        >
          <dt className="min-w-0 text-[0.9375rem] leading-snug text-ink-soft">
            {question.title}
            {!question.is_required && (
              <span className="ml-2 text-[0.75rem] text-ink-faint">Optional</span>
            )}
          </dt>
          <dd className="min-w-0">
            {answer === null ? (
              <span className="text-[0.9375rem] italic text-ink-faint">Not answered</span>
            ) : (
              <span className="whitespace-pre-line break-words text-[0.9375rem] font-medium leading-relaxed text-plp-800">
                {answer}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Meta({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-plp-50 text-plp-600"
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-muted">
          {label}
        </p>
        <p className="mt-1 break-words text-[0.875rem] font-medium text-plp-800">{value}</p>
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
