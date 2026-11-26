/**
 * Chart palette.
 *
 * ---------------------------------------------------------------------------
 * The 5-point scale is DIVERGING data, not categorical: it runs
 * disagree <- neutral -> agree. So it gets two opposite-temperature poles with
 * a neutral gray midpoint. PLP blue is the "agree" pole (on brand), and a warm
 * amber is the "disagree" pole — the warm hue is a DATA ENCODING, not a brand
 * colour. A diverging scale needs two temperatures, and the brand supplies only
 * one; using two blues would make the ends indistinguishable.
 *
 * Validated with the dataviz validator against the white panel surface:
 *
 *   #A8571C,#E09B45,#E8E6DF,#5BA8E0,#124D7E  --mode light --surface #FFFFFF
 *     [PASS] CVD separation      worst adjacent dE 19.8 (deutan) / 19.8 (tritan)
 *     [PASS] Normal-vision floor worst adjacent dE 20.1
 *     [WARN] Contrast vs surface #E09B45 2.35, #E8E6DF 1.25, #5BA8E0 2.59
 *
 * The two FAILs the validator also reports — "lightness band" and "chroma
 * floor" — are CATEGORICAL checks that a diverging ramp is supposed to violate:
 * the ramp deliberately spans a wide lightness range and its midpoint must read
 * as gray.
 *
 * The contrast WARN is NOT dismissed. Its required relief ships with every
 * chart that uses this ramp:
 *   1. a legend is always present,
 *   2. percentages are visible labels wherever they fit,
 *   3. a table view of the same numbers is available.
 * Segments are separated by a 2px surface-coloured GAP, never by a border.
 * ---------------------------------------------------------------------------
 */

/** Diverging 5-step ramp, in original option order (1 -> 5). */
export const SCALE_RAMP = [
  "#A8571C", // 1 — strongly disagree  (dark amber pole)
  "#E09B45", // 2 — disagree           (light amber)
  "#E8E6DF", // 3 — neutral            (gray midpoint)
  "#5BA8E0", // 4 — agree              (light PLP blue)
  "#124D7E", // 5 — strongly agree     (deep PLP blue pole)
] as const;

/**
 * Single-series bar hue — the PLP brand Denim. A lone colour is checked for
 * contrast, not CVD separation: #1D75BD passes the validator on all counts
 * against a white surface.
 */
export const SERIES_HUE = "#1D75BD";

/** Chart chrome — recessive, one step off the surface. Hairline and solid. */
export const CHART_INK = {
  grid: "#DCE6F0",
  axis: "#93A3B3",
  axisText: "#5E7083",
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
