"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Table2, BarChart3 } from "lucide-react";
import { CHART_INK, MARK, SCALE_RAMP, SERIES_HUE } from "@/lib/charts/palette";
import { cn } from "@/lib/utils";

/* ================================================================== *
 * Tooltip
 * ================================================================== */

function ChartTooltip({
  active,
  payload,
  label,
  valueLabel,
  suffix = "",
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string; payload?: Record<string, unknown> }>;
  label?: string | number;
  valueLabel: string;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0];

  return (
    <div className="rounded-xl border border-border bg-surface px-3.5 py-2.5 shadow-raised">
      <p className="text-[0.8125rem] font-medium text-plp-800">
        {(point?.payload?.fullLabel as string) ?? label}
      </p>
      <p className="mt-1 text-[0.8125rem] text-ink-muted">
        {valueLabel}:{" "}
        <span className="font-semibold tabular-nums text-plp-700">
          {point?.value}
          {suffix}
        </span>
      </p>
      {typeof point?.payload?.n === "number" && (
        <p className="mt-0.5 text-[0.75rem] tabular-nums text-ink-faint">
          from {point.payload.n as number} answers
        </p>
      )}
    </div>
  );
}

/* ================================================================== *
 * Year-level distribution — single series, counts
 * ================================================================== */

export function YearLevelChart({
  data,
}: {
  data: Array<{ level: string; count: number }>;
}) {
  if (data.length === 0) return null;

  const max = Math.max(...data.map((d) => d.count));

  return (
    /* Height includes the x-axis band so no nested scrollbar appears. */
    <div className="h-[clamp(14rem,30vh,20rem)] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 18, right: 12, bottom: 4, left: -18 }}
          barCategoryGap="28%"
        >
          <CartesianGrid
            stroke={CHART_INK.grid}
            strokeWidth={1}
            vertical={false}
          />
          <XAxis
            dataKey="level"
            tick={{ fill: CHART_INK.axisText, fontSize: 12 }}
            axisLine={{ stroke: CHART_INK.grid }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            domain={[0, Math.max(1, Math.ceil(max * 1.15))]}
            tick={{ fill: CHART_INK.axisText, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(10,39,65,0.05)" }}
            content={<ChartTooltip valueLabel="Responses" />}
          />
          <Bar
            dataKey="count"
            fill={SERIES_HUE}
            maxBarSize={MARK.maxBarSize}
            radius={MARK.barRadiusVertical}
            /* Single series: the panel title says what is plotted, so no legend. */
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ================================================================== *
 * Section means — single series on the fixed 1..max scale
 * ================================================================== */

export function SectionMeanChart({
  data,
  scaleMax,
}: {
  data: Array<{ label: string; fullLabel: string; mean: number; n: number }>;
  scaleMax: number;
}) {
  if (data.length === 0) return null;

  return (
    <div className="h-[clamp(15rem,32vh,22rem)] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 44, bottom: 4, left: 4 }}
          barCategoryGap="28%"
        >
          <CartesianGrid stroke={CHART_INK.grid} strokeWidth={1} horizontal={false} />
          <XAxis
            type="number"
            /* Anchored to the full scale so bar lengths are comparable and honest. */
            domain={[1, scaleMax]}
            ticks={Array.from({ length: scaleMax }, (_, i) => i + 1)}
            tick={{ fill: CHART_INK.axisText, fontSize: 12 }}
            axisLine={{ stroke: CHART_INK.grid }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={44}
            tick={{ fill: CHART_INK.axisText, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(10,39,65,0.05)" }}
            content={<ChartTooltip valueLabel="Mean" />}
          />
          <Bar
            dataKey="mean"
            fill={SERIES_HUE}
            maxBarSize={MARK.maxBarSize}
            radius={MARK.barRadiusHorizontal}
            isAnimationActive={false}
            label={{
              position: "right",
              formatter: (v: number) => v.toFixed(2),
              fill: CHART_INK.axisText,
              fontSize: 12,
            }}
          >
            {data.map((d) => (
              <Cell key={d.label} fill={SERIES_HUE} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ================================================================== *
 * Likert distribution — diverging segmented bars
 * ================================================================== */

export type DistributionRow = {
  key: string;
  label: string;
  sublabel?: string;
  total: number;
  segments: Array<{ option: string; label: string; descriptor: string; count: number }>;
};

/**
 * Segmented bars for the 5-point distribution.
 *
 * Built in plain HTML rather than a stacked chart library so the 2px
 * surface-coloured gap between segments is exact — the separation comes from the
 * gap, never from a border drawn around each fill.
 *
 * Carries the relief the diverging ramp's contrast WARN requires: a legend is
 * always shown, percentages are labelled inline wherever they fit, and the same
 * numbers are available as a table.
 */
export function DistributionBars({
  rows,
  optionLabels,
}: {
  rows: DistributionRow[];
  optionLabels: string[];
}) {
  const [view, setView] = React.useState<"chart" | "table">("chart");

  if (rows.length === 0) return null;

  return (
    <div>
      {/* ---- Legend (always present) + view toggle ---- */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <ul className="flex flex-wrap gap-x-4 gap-y-2">
          {optionLabels.map((option, i) => (
            <li key={option} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="size-3 shrink-0 rounded-[3px]"
                style={{ backgroundColor: SCALE_RAMP[i] }}
              />
              {/* Text wears text tokens, never the series colour. */}
              <span className="text-[0.75rem] text-ink-muted">{option}</span>
            </li>
          ))}
        </ul>

        <div
          className="flex shrink-0 rounded-xl border border-border bg-muted/50 p-0.5"
          role="group"
          aria-label="Distribution view"
        >
          {(
            [
              ["chart", "Chart", BarChart3],
              ["table", "Table", Table2],
            ] as const
          ).map(([mode, labelText, Icon]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              aria-pressed={view === mode}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[0.625rem] px-2.5 py-1.5",
                "text-[0.75rem] font-medium transition-colors duration-200",
                view === mode
                  ? "bg-surface text-plp-800 shadow-subtle"
                  : "text-ink-muted hover:text-plp-700",
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {labelText}
            </button>
          ))}
        </div>
      </div>

      {view === "chart" ? (
        <ul className="space-y-5">
          {rows.map((row) => (
            <li key={row.key}>
              <div className="flex items-baseline justify-between gap-4">
                <p className="min-w-0 text-[0.875rem] font-medium leading-snug text-plp-800">
                  {row.label}
                </p>
                <p className="shrink-0 text-[0.75rem] tabular-nums text-ink-faint">
                  n={row.total}
                </p>
              </div>
              {row.sublabel && (
                <p className="mt-0.5 text-[0.75rem] text-ink-muted">{row.sublabel}</p>
              )}

              {/* 2px gap in the surface colour does the separating */}
              <div
                className="mt-2 flex h-7 w-full overflow-hidden rounded-md"
                style={{ gap: `${MARK.surfaceGapPx}px` }}
                role="img"
                aria-label={`${row.label}: ${row.segments
                  .map((s) => `${s.count} chose ${s.option}`)
                  .join("; ")}`}
              >
                {row.segments.map((segment, i) => {
                  if (segment.count === 0) return null;
                  const percent = (segment.count / Math.max(1, row.total)) * 100;
                  // Only label inline when the text genuinely fits.
                  const showLabel = percent >= 11;
                  const darkFill = i === 0 || i === 4;

                  return (
                    <span
                      key={segment.option}
                      className="flex items-center justify-center first:rounded-l-md last:rounded-r-md"
                      style={{
                        width: `${percent}%`,
                        backgroundColor: SCALE_RAMP[i],
                      }}
                      title={`${segment.option} — ${segment.count} (${Math.round(percent)}%)`}
                    >
                      {showLabel && (
                        <span
                          className="text-[0.6875rem] font-semibold tabular-nums"
                          /* In-fill label: the one place text takes a colour
                             chosen for contrast against the fill itself. */
                          style={{ color: darkFill ? "#FFFFFF" : "#0A1A2B" }}
                        >
                          {Math.round(percent)}%
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        /* ---- Table view: the same numbers, nothing gated behind colour ---- */
        <div className="overflow-x-panel">
          <table className="w-full min-w-[34rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-border">
                <th
                  scope="col"
                  className="py-2.5 pr-4 text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-ink-muted"
                >
                  Question
                </th>
                {optionLabels.map((option) => (
                  <th
                    key={option}
                    scope="col"
                    className="px-2 py-2.5 text-right text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-ink-muted"
                    title={option}
                  >
                    {/^(\d+)/u.exec(option)?.[1] ?? option}
                  </th>
                ))}
                <th
                  scope="col"
                  className="pl-2 py-2.5 text-right text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-ink-muted"
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-border/60 last:border-0">
                  <th
                    scope="row"
                    className="py-2.5 pr-4 text-[0.8125rem] font-medium leading-snug text-ink-soft"
                  >
                    {row.label}
                  </th>
                  {row.segments.map((segment) => (
                    <td
                      key={segment.option}
                      className="px-2 py-2.5 text-right text-[0.8125rem] tabular-nums text-ink-soft"
                    >
                      {segment.count}
                    </td>
                  ))}
                  <td className="py-2.5 pl-2 text-right text-[0.8125rem] font-semibold tabular-nums text-plp-800">
                    {row.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[0.75rem] leading-relaxed text-ink-faint">
            Columns are the original option numbers:{" "}
            {optionLabels.map((o) => o).join(" · ")}
          </p>
        </div>
      )}
    </div>
  );
}
