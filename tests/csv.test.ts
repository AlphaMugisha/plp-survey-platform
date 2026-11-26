/**
 * CSV export correctness.
 */
import { describe, expect, it } from "vitest";
import { buildCsv, csvField, csvFilename, csvRow } from "@/lib/csv";
import { scaleOptions, sourceSchools as schools } from "@/lib/survey/source";

describe("csvField", () => {
  it("quotes every value", () => {
    expect(csvField("plain")).toBe('"plain"');
  });

  it("doubles internal quotes", () => {
    expect(csvField('He said "yes"')).toBe('"He said ""yes"""');
  });

  it("keeps commas and newlines inside the quoted field", () => {
    expect(csvField("a,b")).toBe('"a,b"');
    expect(csvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("renders a bare empty field for null and undefined", () => {
    // An unquoted empty field is the standard CSV representation of "no value",
    // and distinguishes a missing answer from an answer that is an empty string.
    expect(csvField(null)).toBe("");
    expect(csvField(undefined)).toBe("");
  });

  it("neutralises spreadsheet formula injection", () => {
    expect(csvField("=1+1")).toBe('"\t=1+1"');
    expect(csvField("+cmd")).toBe('"\t+cmd"');
    expect(csvField("-2")).toBe('"\t-2"');
    expect(csvField("@SUM(A1)")).toBe('"\t@SUM(A1)"');
  });

  it("does not mangle ordinary text that merely contains = or -", () => {
    expect(csvField("1 — Strongly Disagree / Not at all")).toBe(
      '"1 — Strongly Disagree / Not at all"',
    );
    expect(csvField("a=b")).toBe('"a=b"');
  });

  it("preserves accents exactly", () => {
    expect(csvField("Collège de l'Immaculée Conception")).toBe(
      '"Collège de l\'Immaculée Conception"',
    );
  });
});

describe("csvRow", () => {
  it("joins fields with commas", () => {
    expect(csvRow(["a", "b", 1])).toBe('"a","b","1"');
  });
});

describe("buildCsv", () => {
  it("writes a BOM and CRLF line endings for Excel", () => {
    const csv = buildCsv(["h"], [["v"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("\r\n");
  });

  it("can omit the BOM", () => {
    expect(buildCsv(["h"], [["v"]], { bom: false }).startsWith("﻿")).toBe(false);
  });

  it("keeps header and row counts aligned", () => {
    const csv = buildCsv(["a", "b"], [
      ["1", "2"],
      ["3", "4"],
    ]);
    const lines = csv.replace(/^﻿/u, "").trimEnd().split("\r\n");
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      expect(line.split('","')).toHaveLength(2);
    }
  });

  it("round-trips an exact option string and school name", () => {
    const option = scaleOptions[2]!;
    const school = schools.find((s) => s.includes("Immaculée"))!;
    const csv = buildCsv(["Answer", "School"], [[option, school]]);

    expect(csv).toContain(`"${option}"`);
    expect(csv).toContain(`"${school.replace(/"/gu, '""')}"`);
  });

  it("survives an answer containing quotes, commas and newlines together", () => {
    const nasty = 'He said "leadership, really" —\nand meant it';
    const csv = buildCsv(["Answer"], [[nasty]]);
    // Field structure intact: exactly one opening and closing quote pair per field.
    expect(csv).toContain('"He said ""leadership, really"" —\nand meant it"');
  });
});

describe("csvFilename", () => {
  it("builds a dated, safe filename", () => {
    expect(csvFilename("plp-survey-1-baseline-term-1", new Date("2026-03-04T10:00:00Z"))).toBe(
      "plp-survey-1-baseline-term-1-2026-03-04.csv",
    );
  });

  it("sanitises unexpected characters", () => {
    expect(csvFilename("My Survey!! (v2)", new Date("2026-01-01T00:00:00Z"))).toBe(
      "my-survey-v2-2026-01-01.csv",
    );
  });
});
