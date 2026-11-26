/**
 * Chart palette.
 *
 * ---------------------------------------------------------------------------
 * The 5-point scale is DIVERGING data, not categorical: it runs
 * disagree <- neutral -> agree. So it gets two opposite-temperature poles with a
 * neutral midpoint, per the diverging rule — amber (low confidence) through a
 * neutral gray to forest green (high confidence). Amber and green are both brand
 * colours, so the chart reads as part of the product.
 *
 * Validated with the dataviz validator against the white panel surface:
 *
 *   #A36A1F,#D9A94E,#E8E6DF,#5F9E7B,#174935  --mode light --surface #FFFFFF
 *     [PASS] CVD separation      worst adjacent dE 19.0 (deutan) / 18.3 (tritan)
 *     [PASS] Normal-vision floor worst adjacent dE 19.1
 *     [WARN] Contrast vs surface #D9A94E 2.16, #E8E6DF 1.25
 *
 * The two FAILs the validator also reports — "lightness band" and "chroma floor"
 * — are CATEGORICAL checks that a diverging ramp is supposed to violate: the ramp
 * deliberately spans a wide lightness range and its midpoint must read as gray.
 *
 * The contrast WARN is NOT dismissed. Its required relief ships with every chart
 * that uses this ramp:
 *   1. a legend is always present,
 *   2. percentages are visible labels wherever they fit,
 *   3. a table view of the same numbers is available.
 * Segments are separated by a 2px surface-coloured GAP, never by a border.
 * ---------------------------------------------------------------------------
 */

/** Diverging 5-step ramp, in original option order (1 -> 5). */
export const SCALE_RAMP = [
  "#A36A1F", // 1 — strongly disagree  (dark amber pole)
  "#D9A94E", // 2 — disagree           (light amber)
  "#E8E6DF", // 3 — neutral            (gray midpoint)
  "#5F9E7B", // 4 — agree              (light green)
  "#174935", // 5 — strongly agree     (dark green pole)
] as const;

/**
 * Single-series bar hue. A lone colour is checked for contrast, not CVD
 * separation: #2C6A4B is 5.0:1 on white, comfortably above 3:1.
 */
export const SERIES_HUE = "#2C6A4B";

/** Chart chrome — recessive, one step off the surface. Hairline and solid. */
export const CHART_INK = {
  grid: "#E2E4DC",
  axis: "#A4ADA6",
  axisText: "#77827A",
  surface: "#FFFFFF",
} as const;

/** Mark specs from the shared chart rules. */
export const MARK = {
  /** Bars never fill their band — the leftover is deliberate air. */
  maxBarSize: 24,
  /** 4px rounded data-end, square at the baseline. */
  barRadiusHorizontal: [0, 4, 4, 0] as [number, number, number, number],
  barRadiusVertical: [4, 4, 0, 0] as [number, number, number, number],
  /** Surface-coloured gap that separates touching fills. */
  surfaceGapPx: 2,
} as const;

/** Colour for the nth scale option, by its position in the original ordering. */
export function scaleColor(index: number): string {
  return SCALE_RAMP[index] ?? SERIES_HUE;
}
