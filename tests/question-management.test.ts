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
import {
  allQuestions,
  participantQuestions,
  sourceQuestions,
} from "@/lib/survey/source";

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

  it("still freezes source questions once the survey is in use", () => {
    expect(flat).toContain("if has_responses or coalesce(locked, false) then");
    expect(sql).toMatch(/questions from the source form are immutable/iu);
  });

  it("lets an admin-added question be edited until it is answered", () => {
    const update = sql.slice(sql.indexOf("-- ---- UPDATE ----"));
    expect(update).toMatch(/already has % answer\(s\) and can no longer be edited/iu);
    // The custom branch returns before reaching the locked-survey check.
    expect(update.indexOf("if coalesce(old.is_custom, false) then")).toBeLessThan(
      update.indexOf("if has_responses or coalesce(locked, false) then"),
    );
  });

  it("never lets a question change identity or be relabelled as custom", () => {
    expect(flat).toContain("if new.entry_id <> old.entry_id or new.survey_id <> old.survey_id then");
    expect(sql).toMatch(/A question cannot be moved or re-identified/iu);
    expect(sql).toMatch(/is_custom cannot be changed after a question is created/iu);
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

  it("starts from the questions this deployment declares it asks", () => {
    expect(loader).toContain("allQuestions");
    // allQuestions is already narrowed to the declared set, so the loader needs
    // to know nothing about withholding. This deployment declares none of them,
    // which is why the application is built entirely from admin-added questions.
    expect(allQuestions.length).toBeLessThanOrEqual(sourceQuestions.length);
  });

  it("ignores a source row the deployment withholds", () => {
    // Matching withheld rows against the SOURCE ids (not the asked ones) is
    // what stops a withheld row reappearing as though an admin had added it.
    expect(loader).toContain(
      "const sourceIds = new Set(sourceQuestions.map((question) => question.entry_id));",
    );
  });

  it("shows no questions when the database is unreachable", () => {
    expect(loader).toContain("if (!isServiceRoleConfigured()) return [];");
    expect(loader).toContain("if (error || !rows) return [];");
  });

  it("never lets a database row override a source question", () => {
    // Source entry ids are skipped when building the custom list, so a row that
    // collides with one cannot replace the verified wording.
    expect(loader).toContain("if (sourceIds.has(entryId)) return [];");
    expect(participantQuestions).toHaveLength(3);
  });

  it("orders additions after the source questions", () => {
    expect(loader).toContain("sort((a, b) => a.index - b.index)");
  });
});

describe("editing and the application toggle", () => {
  const actions = readFileSync(
    join(process.cwd(), "src", "app", "admin", "surveys", "actions.ts"),
    "utf8",
  );

  it("refuses to edit a source question", () => {
    const edit = actions.slice(actions.indexOf("export async function updateSurveyQuestion"));
    expect(edit).toContain("if (!question.is_custom)");
    expect(edit).toMatch(/cannot be edited/iu);
  });

  it("refuses to edit a question that has answers", () => {
    const edit = actions.slice(actions.indexOf("export async function updateSurveyQuestion"));
    expect(edit).toMatch(/can no longer be changed/iu);
  });

  it("validates options identically for add and edit", () => {
    // One shared parser, so the two paths cannot drift apart.
    expect(actions).toContain("function parseOptions(");
    expect(actions).toContain("const result = parseOptions(parsed.data.options, type);");
  });

  it("can both open and close applications", () => {
    const toggle = actions.slice(actions.indexOf("export async function toggleApplications"));
    expect(toggle).toContain('next !== "active" && next !== "closed"');
    expect(toggle).toMatch(/Applications are open/iu);
    expect(toggle).toMatch(/Applications are closed/iu);
  });

  it("says plainly that closing keeps existing submissions", () => {
    const toggle = actions.slice(actions.indexOf("export async function toggleApplications"));
    expect(toggle).toMatch(/already received are untouched/iu);
  });

  it("revalidates the public pages when the window changes", () => {
    const toggle = actions.slice(actions.indexOf("export async function toggleApplications"));
    expect(toggle).toContain('revalidatePath("/survey")');
    expect(toggle).toContain('revalidatePath("/")');
  });
});
