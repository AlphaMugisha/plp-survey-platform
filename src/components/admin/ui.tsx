import * as React from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

/** Page heading used across dashboard pages. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-plp-500">
              {eyebrow}
            </p>
            <div className="rule-accent mt-2.5 max-w-[4.5rem]" />
          </>
        )}
        <h1 className="mt-4 text-balance font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-plp-800 sm:text-[2rem]">
          {title}
        </h1>
        {description && (
          <p className="mt-2.5 max-w-2xl text-[0.9375rem] leading-relaxed text-ink-muted">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2.5">{actions}</div>}
    </header>
  );
}

/** Headline metric tile. */
export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  tone?: "default" | "brand" | "accent";
}) {
  return (
    <div
      className={cn(
        "card-lux card-quiet group p-5",
        tone === "brand" && "bg-plp-50/60",
        tone === "accent" && "bg-accent-100/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.1em] text-ink-muted">
          {label}
        </p>
        {icon && (
          <span
            aria-hidden="true"
            className={cn(
              "inline-flex size-8 shrink-0 items-center justify-center rounded-lg",
              "transition-colors duration-300 ease-premium",
              tone === "accent"
                ? "bg-accent-400/20 text-accent-600 group-hover:bg-accent-400/30"
                : "bg-plp-50 text-plp-600 group-hover:bg-plp-100",
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <p className="mt-3 font-display text-[2rem] font-bold leading-none tracking-tight tabular-nums text-plp-800 transition-colors duration-300 group-hover:text-plp-600">
        {value}
      </p>
      {sub && <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-muted">{sub}</p>}
    </div>
  );
}

/** Titled panel that wraps a chart or table. */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("card-lux card-quiet overflow-hidden", className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <h2 className="font-display text-[1.0625rem] font-semibold leading-snug tracking-tight text-plp-800">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-muted">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
      </header>
      <div className={cn("p-5 sm:p-6", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Honest empty state — never fake numbers. */
export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span
        aria-hidden="true"
        className="inline-flex size-12 items-center justify-center rounded-2xl border border-border bg-muted/60 text-ink-faint"
      >
        {icon ?? <Inbox className="size-5" />}
      </span>
      <p className="mt-4 font-display text-[1.0625rem] font-semibold text-plp-800">{title}</p>
      <p className="mt-2 max-w-sm text-[0.9375rem] leading-relaxed text-ink-muted">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Horizontal meter for a 1–5 mean. */
export function ScaleMeter({
  mean,
  max,
  label,
  count,
}: {
  mean: number | null;
  max: number;
  label: string;
  count: number;
}) {
  const percent = mean === null ? 0 : ((mean - 1) / (max - 1)) * 100;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="min-w-0 text-[0.875rem] leading-snug text-ink-soft">{label}</p>
        <p className="shrink-0 font-display text-[0.9375rem] font-semibold tabular-nums text-plp-800">
          {mean === null ? "—" : mean.toFixed(2)}
        </p>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <div
          className="relative h-2 flex-1 overflow-hidden rounded-full bg-plp-100"
          role="img"
          aria-label={`${label}: mean ${mean === null ? "no data" : mean.toFixed(2)} out of ${max}, from ${count} answers`}
        >
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-plp-600 to-plp-accent"
            style={{
              width: `${percent}%`,
              boxShadow: percent > 0 ? "0 0 10px rgba(47,163,107,0.45)" : undefined,
            }}
          />
        </div>
        <span className="shrink-0 text-[0.75rem] tabular-nums text-ink-faint">n={count}</span>
      </div>
    </div>
  );
}
