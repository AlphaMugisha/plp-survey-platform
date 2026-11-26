/**
 * Numeric conversion for analytics.
 *
 * The point of these tests is that conversion is derived at READ time from the
 * original option ordering, and that nothing converts the stored value.
 */
import { describe, expect, it } from "vitest";
import {
  SCALE_MAX,
  SCALE_MIN,
  distribution,
  formatMean,
  meanScale,
  scaleDescriptor,
  scaleShortLabel,
  scaleValueOf,
} from "@/lib/survey/scale";
import { scaleOptions } from "@/lib/survey/source";

describe("scale bounds", () => {
  it("spans 1..5, matching the original five options", () => {
    expect(SCALE_MIN).toBe(1);
    expect(SCALE_MAX).toBe(5);
    expect(scaleOptions).toHaveLength(5);
  });
});

describe("scaleValueOf", () => {
  it("maps each original option to its 1-based position", () => {
    scaleOptions.forEach((option, i) => {
      expect(scaleValueOf(option)).toBe(i + 1);
    });
  });

  it("returns null for anything that is not an original option", () => {
    expect(scaleValueOf("3")).toBeNull();
    expect(scaleValueOf("Neutral")).toBeNull();
    expect(scaleValueOf("3 - Neutral / Sometimes")).toBeNull(); // hyphen, not em dash
    expect(scaleValueOf("")).toBeNull();
    expect(scaleValueOf(null)).toBeNull();
    expect(scaleValueOf(undefined)).toBeNull();
  });

  it("does not coerce free-text answers into numbers", () => {
    expect(scaleValueOf("I set goals and work hard")).toBeNull();
    expect(scaleValueOf("S3")).toBeNull();
  });
});

describe("meanScale", () => {
  it("averages the positions of the given options", () => {
    expect(meanScale([scaleOptions[0]!, scaleOptions[4]!])).toBe(3);
    expect(meanScale([scaleOptions[3]!, scaleOptions[3]!])).toBe(4);
  });

  it("ignores non-scale and blank answers", () => {
    expect(meanScale([scaleOptions[4]!, "free text", "", null, undefined])).toBe(5);
  });

  it("returns null when there is no scale data at all", () => {
    expect(meanScale([])).toBeNull();
    expect(meanScale(["free text", null])).toBeNull();
  });
});

describe("distribution", () => {
  it("counts each original option, in original order", () => {
    const answers = [
      scaleOptions[0]!,
      scaleOptions[0]!,
      scaleOptions[2]!,
      scaleOptions[4]!,
    ];
    const dist = distribution(answers);

    expect(dist).toHaveLength(5);
    expect(dist.map((d) => d.option)).toEqual(scaleOptions);
    expect(dist.map((d) => d.count)).toEqual([2, 0, 1, 0, 1]);
  });

  it("returns all-zero counts for no data, never fabricated numbers", () => {
    expect(distribution([]).map((d) => d.count)).toEqual([0, 0, 0, 0, 0]);
  });

  it("ignores values that are not original options", () => {
    expect(distribution(["3", "Neutral", ""]).map((d) => d.count)).toEqual([0, 0, 0, 0, 0]);
  });
});

describe("display helpers", () => {
  it("extracts the leading number for chart labels", () => {
    expect(scaleShortLabel("3 — Neutral / Sometimes")).toBe("3");
  });

  it("extracts the descriptor after the number", () => {
    expect(scaleDescriptor("3 — Neutral / Sometimes")).toBe("Neutral / Sometimes");
    expect(scaleDescriptor("1 — Strongly Disagree / Not at all")).toBe(
      "Strongly Disagree / Not at all",
    );
  });

  it("shows an em dash for no data rather than 0", () => {
    expect(formatMean(null)).toBe("—");
    expect(formatMean(3.456)).toBe("3.5");
  });
});
