/**
 * Admin-managed questions.
 *
 * The property that matters: an administrator may append questions to the live
 * application and remove ones they added, but the 28 questions seeded from the
 * verified Google Form can never be edited or deleted — and nothing that has
 * been answered can be deleted either.
 *
 * These assert the SQL guard and the source-of-truth wiring. The guard is
 * enforced in three independent places (UI, server action, database trigger);
 * this covers the database rules and the structural assumptions behind them.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { allQuestions } from "@/lib/survey/source";

const sql = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20261126175105_admin_added_questions.sql"),
  "utf8",
);
const flat = sql.replace(/\s+/gu, " ");

describe("seeded questions are distinguished from admin additions", () => {
  it("adds an is_custom flag defaulting to false", () => {
    expect(flat).toContain(
      "alter table public.questions add column if not exists is_custom boolean not null default false",
    );
  });

  it("documents what the flag means", () => {
    const comment = sql.slice(sql.indexOf("comment on column public.questions.is_custom"));
    expect(comment).toMatch(/seeded from data\/survey-source\.json/iu);
    expect(comment).toMatch(/never deletable/iu);
  });
});

describe("the guard permits appending but protects what exists", () => {
  it("fires on insert, update and delete", () => {
    expect(flat).toContain(
      "create trigger questions_guard_immutable before insert or update or delete on public.questions",
    );
  });

  it("allows INSERT, because adding cannot invalidate an existing answer", () => {
    expect(sql).toMatch(/INSERT: always allowed/iu);
  });

  it("refuses to delete a question that came from the source form", () => {
    expect(flat).toContain("if not coalesce(old.is_custom, false) then");
    expect(sql).toMatch(/came from the verified source form and cannot be deleted/iu);
  });

  it("refuses to delete a question that already has answers", () => {
    expect(flat).toContain("from public.answers a where a.question_id = old.id");
    expect(sql).toMatch(/already has % answer\(s\) and cannot be deleted/iu);
  });

  it("still freezes the wording of existing questions once in use", () => {
    expect(flat).toContain("if has_responses or coalesce(locked, false) then");
    expect(sql).toMatch(/existing questions are immutable/iu);
  });

  it("pins search_path on the guard function", () => {
    expect(flat).toContain("create or replace function public.guard_question_changes()");
    expect(flat).toContain("set search_path = ''");
  });

  it("handles DELETE without reading the unassigned NEW record", () => {
    expect(flat).toContain(
      "target_survey := case when tg_op = 'DELETE' then old.survey_id else new.survey_id end",
    );
  });
});

describe("the server action marks and checks correctly", () => {
  const actions = readFileSync(
    join(process.cwd(), "src", "app", "admin", "surveys", "actions.ts"),
    "utf8",
  );

  it("flags every admin-added question as custom", () => {
    expect(actions).toContain("is_custom: true");
  });

  it("never deletes a question that is not custom", () => {
    expect(actions).toContain("if (!question.is_custom)");
    expect(actions).toMatch(/cannot be removed/iu);
  });

  it("never deletes a question that has answers", () => {
    expect(actions).toMatch(/already has \$\{count\} answer\(s\)/u);
  });

  it("requires a manager for both adding and removing", () => {
    const add = actions.slice(actions.indexOf("export async function addSurveyQuestion"));
    const remove = actions.slice(actions.indexOf("export async function removeSurveyQuestion"));
    expect(add).toContain("requireManagerOrFail()");
    expect(remove.slice(0, 400)).toContain("requireManagerOrFail()");
  });

  it("revalidates the participant survey, so additions show up immediately", () => {
    expect(actions).toContain('revalidatePath("/survey")');
  });
});

describe("the application reads questions from the database", () => {
  const loader = readFileSync(
    join(process.cwd(), "src", "lib", "survey", "database-questions.ts"),
    "utf8",
  );

  it("starts from the verified source questions", () => {
    expect(loader).toContain("allQuestions");
    expect(allQuestions).toHaveLength(28);
  });

  it("falls back to the source when the database is unreachable", () => {
    expect(loader).toContain("if (!isServiceRoleConfigured()) return allQuestions;");
    expect(loader).toContain("if (error || !rows) return allQuestions;");
  });

  it("never lets a database row override a source question", () => {
    // Source entry ids are skipped when building the custom list, so a row that
    // collides with one cannot replace the verified wording.
    expect(loader).toContain("if (sourceById.has(entryId)) return [];");
  });

  it("orders additions after the source questions", () => {
    expect(loader).toContain("sort((a, b) => a.index - b.index)");
  });
});
