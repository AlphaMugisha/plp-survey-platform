/**
 * The deployment overlay.
 *
 * `data/survey-source.json` is the verified extract of the original Google Form
 * and must never be edited for one rollout. Where a rollout genuinely needs
 * different answer options, `data/deployment.json` declares them. These tests
 * pin down what the overlay may and may not do.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  allQuestions,
  sourceQuestions,
  sourceSchools,
  sourceYearLevels,
  schools,
  schoolQuestion,
  yearLevelQuestion,
  deployment,
  hasDeploymentOverrides,
} from "@/lib/survey/source";
import { emptyFormValues } from "@/lib/survey/schema";

const raw = JSON.parse(
  readFileSync(join(process.cwd(), "data", "survey-source.json"), "utf8"),
) as { items: Array<{ type: string; title: string; options?: string[] }> };

describe("the source file is never altered by an overlay", () => {
  it("keeps all 180 official schools available in the source", () => {
    const rawSchools = raw.items.find((i) => i.type === "dropdown")?.options ?? [];
    expect(sourceSchools).toEqual(rawSchools);
    expect(sourceSchools).toHaveLength(180);
  });

  it("keeps the official S1-S6 year levels in the source", () => {
    expect(sourceYearLevels).toEqual(["S1", "S2", "S3", "S4", "S5", "S6"]);
  });

  it("leaves every question's wording, id, type and required flag untouched", () => {
    expect(allQuestions).toHaveLength(sourceQuestions.length);
    allQuestions.forEach((q, i) => {
      const src = sourceQuestions[i]!;
      expect(q.title).toBe(src.title);
      expect(q.description).toBe(src.description);
      expect(q.entry_id).toBe(src.entry_id);
      expect(q.type).toBe(src.type);
      expect(q.required).toBe(src.required);
      expect(q.index).toBe(src.index);
    });
  });

  it("changes only the options of the school and year-level questions", () => {
    const changed = allQuestions.filter((q, i) => {
      const src = sourceQuestions[i]!;
      return JSON.stringify(q.options ?? null) !== JSON.stringify(src.options ?? null);
    });

    const allowed = new Set([schoolQuestion.entry_id, yearLevelQuestion.entry_id]);
    for (const q of changed) {
      expect(allowed.has(q.entry_id), `unexpected override on "${q.title}"`).toBe(true);
    }
  });
});

describe("every override is declared with a reason", () => {
  it("names the deployment", () => {
    expect(deployment.name.length).toBeGreaterThan(0);
  });

  it("gives a reason for each override, so none is silent", () => {
    for (const [key, override] of Object.entries(deployment.overrides)) {
      if (!override) continue;
      expect(override.reason.length, `${key} needs a reason`).toBeGreaterThan(20);
      expect(override.options.length, `${key} needs at least one option`).toBeGreaterThan(0);
    }
  });
});

describe("the active deployment", () => {
  it("is overridden", () => {
    expect(hasDeploymentOverrides).toBe(true);
  });

  it("offers only New Generation Academy", () => {
    expect(schools).toEqual(["New Generation Academy"]);
    expect(schoolQuestion.options).toEqual(["New Generation Academy"]);
  });

  it("offers Grade 7 to Grade 10", () => {
    expect(yearLevelQuestion.options).toEqual(["Grade 7", "Grade 8", "Grade 9", "Grade 10"]);
  });

  it("pre-fills the school, because there is no choice to make", () => {
    const values = emptyFormValues();
    expect(values[schoolQuestion.fieldKey]).toBe("New Generation Academy");
  });

  it("does not pre-fill the year level, which is a real choice", () => {
    const values = emptyFormValues();
    expect(values[yearLevelQuestion.fieldKey]).toBe("");
  });

  it("leaves every other answer blank", () => {
    const values = emptyFormValues();
    const prefilled = Object.entries(values).filter(([, v]) => v !== "");
    expect(prefilled.map(([k]) => k)).toEqual([schoolQuestion.fieldKey]);
  });
});

describe("overrides reach the database migration", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase", "migrations", "20260101000800_deployment_overrides.sql"),
    "utf8",
  );

  it("inserts every school the deployment offers", () => {
    for (const name of schools) {
      expect(sql).toContain(name);
    }
  });

  it("sets the year-level options on the right question", () => {
    expect(sql).toContain(String(yearLevelQuestion.entry_id));
    for (const level of yearLevelQuestion.options!) {
      expect(sql).toContain(level);
    }
  });

  it("deactivates rather than deletes the schools it does not use", () => {
    expect(sql).toContain("set is_active = false");
    expect(sql).not.toMatch(/delete\s+from\s+public\.schools/iu);
  });

  it("refuses to run once responses exist", () => {
    expect(sql).toContain("if v_responses > 0 then");
    expect(sql).toMatch(/create a new survey instead/iu);
  });

  it("restores the lock it had to lift", () => {
    expect(sql).toContain("update public.surveys set is_locked = false");
    expect(sql).toContain("update public.surveys set is_locked = coalesce(v_locked, true)");
  });
});
