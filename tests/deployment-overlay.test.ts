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
  withheldQuestions,
  sourceSections,
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
    // The deployed set may be a declared SUBSET of the source, so match on
    // entry id rather than position. Every question that survives must be
    // character-for-character the source question.
    const byEntryId = new Map(sourceQuestions.map((q) => [q.entry_id, q]));
    for (const q of allQuestions) {
      const src = byEntryId.get(q.entry_id);
      expect(src, `entry ${q.entry_id} is not in the source`).toBeDefined();
      expect(q.title).toBe(src!.title);
      expect(q.description).toBe(src!.description);
      expect(q.type).toBe(src!.type);
      expect(q.required).toBe(src!.required);
      expect(q.index).toBe(src!.index);
    }
  });

  it("asks a subset of the source, never anything the source does not have", () => {
    const sourceIds = new Set(sourceQuestions.map((q) => q.entry_id));
    for (const q of allQuestions) {
      expect(sourceIds.has(q.entry_id), `"${q.title}" is not in the source`).toBe(true);
    }
    expect(allQuestions.length + withheldQuestions.length).toBe(sourceQuestions.length);
  });

  it("keeps the whole instrument available even when questions are withheld", () => {
    expect(sourceQuestions).toHaveLength(28);
    expect(sourceSections).toHaveLength(5);
  });

  it("changes only the options of the school and year-level questions", () => {
    const byEntryId = new Map(sourceQuestions.map((q) => [q.entry_id, q]));
    const changed = allQuestions.filter((q) => {
      const src = byEntryId.get(q.entry_id)!;
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

      // An option override must offer something; a question set may be empty,
      // which declares that the admin writes every question.
      if ("options" in override) {
        expect(override.options.length, `${key} must offer an option`).toBeGreaterThan(0);
      }
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

  it("offers Grade 7 to Grade 10, plus Year 1 and Year 2", () => {
    expect(yearLevelQuestion.options).toEqual([
      "Grade 7",
      "Grade 8",
      "Grade 9",
      "Grade 10",
      "Year 1",
      "Year 2",
    ]);
  });

  it("pre-fills the school when the school question is asked", () => {
    // This deployment withholds it, so the form has no school field at all —
    // but the behaviour must still hold for a deployment that asks it.
    const values = emptyFormValues([schoolQuestion]);
    expect(values[schoolQuestion.fieldKey]).toBe("New Generation Academy");
  });

  it("does not pre-fill the year level, which is a real choice", () => {
    const values = emptyFormValues([yearLevelQuestion]);
    expect(values[yearLevelQuestion.fieldKey]).toBe("");
  });

  it("leaves every answer blank on a form it does not pre-fill", () => {
    const values = emptyFormValues();
    const prefilled = Object.entries(values).filter(([, v]) => v !== "");
    expect(prefilled.map(([k]) => k)).toEqual([]);
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

describe("adding a year level is additive, never destructive", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase", "migrations", "20261127000100_add_year_levels.sql"),
    "utf8",
  );

  it("offers every level the overlay declares", () => {
    for (const level of yearLevelQuestion.options!) {
      expect(sql).toContain(level);
    }
  });

  it("aborts rather than removing or renaming an existing level", () => {
    expect(sql).toMatch(/Refusing to continue/iu);
    expect(sql).toMatch(/would remove existing year level/iu);
    // and it names the likeliest cause rather than leaving you guessing
    expect(sql).toMatch(/deployment_overrides\.sql\) has not been applied yet/iu);
    expect(sql).toContain("if missing is not null then");
  });

  it("checks the current options are a subset of the new ones", () => {
    expect(sql).toContain("from jsonb_array_elements_text(current_opts) as existing(value)");
    expect(sql).toContain("where wanted.value = existing.value");
  });

  it("is a no-op when already applied", () => {
    expect(sql).toContain("if current_opts = target_opts then");
  });

  it("restores the lock it lifts", () => {
    expect(sql).toContain("update public.surveys set is_locked = false");
    expect(sql).toContain("update public.surveys set is_locked = coalesce(v_locked, true)");
  });

  it("verifies afterwards that no answer was orphaned", () => {
    expect(sql).toMatch(/no longer match an offered year level/iu);
    expect(sql).toContain("select count(*) into orphans");
  });
});
