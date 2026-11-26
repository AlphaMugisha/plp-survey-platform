/**
 * Numeric interpretation of the 5-point scale — FOR ANALYTICS CALCULATION ONLY.
 *
 * The database always stores the exact original option string
 * (e.g. "3 — Neutral / Sometimes"). Numbers are derived here, at read time,
 * purely so averages can be computed. Nothing in this module is ever persisted
 * as an answer value.
 *
 * The number comes from the option's position in the original option ordering,
 * so it stays correct even if the wording of an option were to change.
 */
import { scaleOptions } from "./source";

/** option string -> 1-based position in the original ordering */
const positionByOption = new Map<string, number>(
  scaleOptions.map((opt, i) => [opt, i + 1] as const),
);

export const SCALE_MIN = 1;
export const SCALE_MAX = scaleOptions.length;

/**
 * Numeric value of a stored answer string, or null when the string is not one of
 * the original scale options (which would mean the answer is not a scale answer).
 */
export function scaleValueOf(answer: string | null | undefined): number | null {
  if (!answer) return null;
  return positionByOption.get(answer) ?? null;
}

/** Short label for charts, e.g. "3 — Neutral / Sometimes" -> "3". */
export function scaleShortLabel(option: string): string {
  const match = /^(\d+)/u.exec(option);
  return match?.[1] ?? option;
}

/** Text after the leading number, e.g. "Neutral / Sometimes". */
export function scaleDescriptor(option: string): string {
  return option.replace(/^\d+\s*—\s*/u, "").trim();
}

/** Mean of the numeric values, ignoring non-scale/blank answers. Null when no data. */
export function meanScale(answers: Array<string | null | undefined>): number | null {
  let sum = 0;
  let n = 0;
  for (const a of answers) {
    const v = scaleValueOf(a);
    if (v !== null) {
      sum += v;
      n += 1;
    }
  }
  return n === 0 ? null : sum / n;
}

/** Count of each original option string, in the original option order. */
export function distribution(answers: Array<string | null | undefined>) {
  const counts = new Map<string, number>(scaleOptions.map((o) => [o, 0] as const));
  for (const a of answers) {
    if (a && counts.has(a)) counts.set(a, (counts.get(a) ?? 0) + 1);
  }
  return scaleOptions.map((option) => ({
    option,
    label: scaleShortLabel(option),
    descriptor: scaleDescriptor(option),
    count: counts.get(option) ?? 0,
  }));
}

/** Round to one decimal for display. Returns "—" for no data. */
export function formatMean(mean: number | null): string {
  return mean === null ? "—" : mean.toFixed(1);
}
