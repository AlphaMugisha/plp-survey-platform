"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Filter bar for the responses table.
 *
 * State lives in the URL so a filtered view is shareable and survives a reload,
 * and so the CSV export can reuse exactly the same query string.
 */
export function ResponseFilters({
  schools,
  yearLevels,
  surveySlug,
}: {
  schools: Array<{ name: string; count: number }>;
  yearLevels: string[];
  surveySlug: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const [search, setSearch] = React.useState(params.get("q") ?? "");

  const school = params.get("school") ?? "";
  const year = params.get("year") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";

  const hasFilters = Boolean(search || school || year || from || to);

  const update = React.useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      // Any filter change returns to the first page.
      next.delete("page");
      router.push(`/admin/responses?${next.toString()}`);
    },
    [params, router],
  );

  // Debounce the free-text search so typing does not fire a request per keystroke.
  React.useEffect(() => {
    const current = params.get("q") ?? "";
    if (search === current) return;
    const timer = window.setTimeout(() => update({ q: search || null }), 350);
    return () => window.clearTimeout(timer);
  }, [search, params, update]);

  const exportHref = `/api/admin/export?${new URLSearchParams({
    survey: surveySlug,
    ...(search ? { q: search } : {}),
    ...(school ? { school } : {}),
    ...(year ? { year } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  }).toString()}`;

  return (
    <div className="card-lux mb-6 p-4 sm:p-5">
      {/* One row of controls above the table */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.7fr)]">
        {/* Search */}
        <div>
          <Label htmlFor="filter-search" className="mb-1.5 block text-[0.75rem] text-ink-muted">
            Search student
          </Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
              aria-hidden="true"
            />
            <Input
              id="filter-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or email…"
              className="pl-10"
            />
          </div>
        </div>

        {/* School */}
        <div>
          <Label htmlFor="filter-school" className="mb-1.5 block text-[0.75rem] text-ink-muted">
            School
          </Label>
          <FilterSelect
            id="filter-school"
            value={school}
            onChange={(v) => update({ school: v })}
            placeholder={`All schools (${schools.length})`}
            options={schools.map((s) => ({
              value: s.name,
              label: `${s.name} (${s.count})`,
            }))}
          />
        </div>

        {/* Year level */}
        <div>
          <Label htmlFor="filter-year" className="mb-1.5 block text-[0.75rem] text-ink-muted">
            Year level
          </Label>
          <FilterSelect
            id="filter-year"
            value={year}
            onChange={(v) => update({ year: v })}
            placeholder="All years"
            options={yearLevels.map((y) => ({ value: y, label: y }))}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <div>
          <Label htmlFor="filter-from" className="mb-1.5 block text-[0.75rem] text-ink-muted">
            Submitted from
          </Label>
          <Input
            id="filter-from"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => update({ from: e.target.value || null })}
          />
        </div>
        <div>
          <Label htmlFor="filter-to" className="mb-1.5 block text-[0.75rem] text-ink-muted">
            Submitted to
          </Label>
          <Input
            id="filter-to"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => update({ to: e.target.value || null })}
          />
        </div>

        <div className="flex flex-wrap gap-2.5">
          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => {
                setSearch("");
                router.push("/admin/responses");
              }}
            >
              <X aria-hidden="true" />
              Clear
            </Button>
          )}
          <Button asChild variant="outline" size="md">
            {/* A plain link so the browser handles the download */}
            <a href={exportHref} download>
              <Download aria-hidden="true" />
              Export CSV
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function FilterSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string | null) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value || null)}
        className={cn(
          "h-12 w-full appearance-none rounded-xl border border-border bg-surface pl-4 pr-9",
          "text-[0.9375rem] text-ink shadow-subtle",
          "transition-all duration-200 ease-premium hover:border-forest-200",
          "focus:border-forest-400 focus:shadow-glow-emerald focus:outline-none",
        )}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
        fill="none"
      >
        <path
          d="M6 8l4 4 4-4"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
