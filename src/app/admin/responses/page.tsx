import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, SearchX, Table2 } from "lucide-react";
import { PageHeader, Panel, EmptyState } from "@/components/admin/ui";
import { ResponseFilters } from "@/components/admin/response-filters";
import { SetupNotice } from "@/components/site/setup-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin/auth";
import {
  getDefaultSurvey,
  listResponses,
  listSchoolsWithResponses,
  listYearLevels,
} from "@/lib/admin/queries";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { formatDateTime, truncate } from "@/lib/utils";

export const metadata: Metadata = { title: "Responses" };

type SearchParams = {
  q?: string;
  school?: string;
  year?: string;
  from?: string;
  to?: string;
  page?: string;
};

export default async function ResponsesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const params = await searchParams;

  if (!isSupabaseConfigured()) {
    return (
      <>
        <PageHeader eyebrow="Dashboard" title="Responses" />
        <SetupNotice context="read" />
      </>
    );
  }

  const survey = await getDefaultSurvey();
  if (!survey) {
    return (
      <>
        <PageHeader eyebrow="Dashboard" title="Responses" />
        <Panel title="No survey found" bodyClassName="p-0">
          <EmptyState
            title="The survey has not been seeded yet"
            description="Run the migrations in supabase/migrations against your Supabase project first."
          />
        </Panel>
      </>
    );
  }

  const page = Number.parseInt(params.page ?? "1", 10) || 1;

  const [result, schools, yearLevels] = await Promise.all([
    listResponses({
      surveyId: survey.id,
      search: params.q,
      school: params.school,
      yearLevel: params.year,
      from: params.from,
      to: params.to,
      page,
    }),
    listSchoolsWithResponses(survey.id),
    listYearLevels(survey.id),
  ]);

  const hasFilters = Boolean(
    params.q || params.school || params.year || params.from || params.to,
  );

  /** Preserve the current filters when paging. */
  function pageHref(target: number): string {
    const next = new URLSearchParams();
    if (params.q) next.set("q", params.q);
    if (params.school) next.set("school", params.school);
    if (params.year) next.set("year", params.year);
    if (params.from) next.set("from", params.from);
    if (params.to) next.set("to", params.to);
    if (target > 1) next.set("page", String(target));
    const qs = next.toString();
    return qs ? `/admin/responses?${qs}` : "/admin/responses";
  }

  const firstIndex = (result.page - 1) * result.pageSize + 1;
  const lastIndex = Math.min(result.page * result.pageSize, result.total);

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Responses"
        description="Search, filter and open individual submissions."
        actions={
          <Badge variant="neutral" size="lg">
            {result.total} {result.total === 1 ? "response" : "responses"}
          </Badge>
        }
      />

      <ResponseFilters
        schools={schools}
        yearLevels={yearLevels}
        surveySlug={survey.slug}
      />

      <Panel
        title={hasFilters ? "Filtered responses" : "All responses"}
        description={
          result.total > 0
            ? `Showing ${firstIndex}–${lastIndex} of ${result.total}.`
            : undefined
        }
        bodyClassName="p-0"
      >
        {result.rows.length === 0 ? (
          <EmptyState
            icon={hasFilters ? <SearchX className="size-5" /> : <Table2 className="size-5" />}
            title={hasFilters ? "No responses match these filters" : "No responses yet"}
            description={
              hasFilters
                ? "Try widening the date range, clearing the school filter, or searching for a shorter part of the name."
                : "Responses will appear here as students submit the baseline survey."
            }
            action={
              hasFilters ? (
                <Button asChild variant="outline">
                  <Link href="/admin/responses">Clear filters</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="overflow-x-panel">
              <table className="w-full min-w-[52rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border bg-cream/50">
                    <Th>Student</Th>
                    <Th>Email</Th>
                    <Th>School</Th>
                    <Th>Year</Th>
                    <Th align="right">Submitted</Th>
                    <Th align="right">
                      <span className="sr-only">Open</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border/60 transition-colors last:border-0 hover:bg-forest-50/40"
                    >
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/admin/responses/${row.id}`}
                          className="text-[0.875rem] font-medium text-forest-700 underline-offset-4 hover:underline"
                        >
                          {row.full_name}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-[0.8125rem] text-ink-muted">
                        {row.email}
                      </td>
                      <td className="px-5 py-3.5 text-[0.875rem] text-ink-soft">
                        {truncate(row.school_name, 42)}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant="neutral" size="sm">
                          {row.year_level}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right text-[0.8125rem] tabular-nums text-ink-muted">
                        {formatDateTime(row.submitted_at)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={`/admin/responses/${row.id}`}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[0.8125rem] font-medium text-forest-700 transition-colors hover:bg-forest-50"
                        >
                          Open
                          <ChevronRight className="size-3.5" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ---- Pagination ---- */}
            {result.pageCount > 1 && (
              <nav
                aria-label="Pagination"
                className="flex items-center justify-between gap-4 border-t border-border/70 px-5 py-4"
              >
                <p className="text-[0.8125rem] tabular-nums text-ink-muted">
                  Page {result.page} of {result.pageCount}
                </p>
                <div className="flex gap-2">
                  <Button
                    asChild={result.page > 1}
                    variant="outline"
                    size="sm"
                    disabled={result.page <= 1}
                  >
                    {result.page > 1 ? (
                      <Link href={pageHref(result.page - 1)} rel="prev">
                        <ChevronLeft aria-hidden="true" />
                        Previous
                      </Link>
                    ) : (
                      <span>
                        <ChevronLeft aria-hidden="true" />
                        Previous
                      </span>
                    )}
                  </Button>
                  <Button
                    asChild={result.page < result.pageCount}
                    variant="outline"
                    size="sm"
                    disabled={result.page >= result.pageCount}
                  >
                    {result.page < result.pageCount ? (
                      <Link href={pageHref(result.page + 1)} rel="next">
                        Next
                        <ChevronRight aria-hidden="true" />
                      </Link>
                    ) : (
                      <span>
                        Next
                        <ChevronRight aria-hidden="true" />
                      </span>
                    )}
                  </Button>
                </div>
              </nav>
            )}
          </>
        )}
      </Panel>
    </>
  );
}

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
