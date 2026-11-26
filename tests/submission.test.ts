/**
 * Submission endpoint: server-side validation, answer relationships and the
 * rollback path. Supabase is mocked so the route's own logic is what is tested.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { allQuestions, nameQuestion, schoolQuestion, yearLevelQuestion } from "@/lib/survey/source";

/* ------------------------------------------------------------------ *
 * A small chainable stand-in for the Supabase query builder
 * ------------------------------------------------------------------ */

type TableState = {
  rows?: unknown;
  single?: unknown;
  error?: { message: string; code?: string } | null;
  insertError?: { message: string; code?: string } | null;
};

const tables: Record<string, TableState> = {};
const calls: Array<{ table: string; op: string; payload?: unknown }> = [];

function builderFor(table: string) {
  const state = tables[table] ?? {};
  let lastOp = "select";
  let insertPayload: unknown;

  const builder: Record<string, unknown> = {
    select() {
      return builder;
    },
    eq() {
      return builder;
    },
    in() {
      return builder;
    },
    order() {
      return builder;
    },
    insert(payload: unknown) {
      lastOp = "insert";
      insertPayload = payload;
      calls.push({ table, op: "insert", payload });
      return builder;
    },
    delete() {
      lastOp = "delete";
      calls.push({ table, op: "delete" });
      return builder;
    },
    maybeSingle() {
      return Promise.resolve({ data: state.single ?? null, error: state.error ?? null });
    },
    single() {
      if (lastOp === "insert" && state.insertError) {
        return Promise.resolve({ data: null, error: state.insertError });
      }
      return Promise.resolve({ data: state.single ?? null, error: state.error ?? null });
    },
    // Awaiting the builder directly (no .single()) resolves the list form.
    then(resolve: (value: unknown) => unknown) {
      if (lastOp === "insert") {
        return Promise.resolve({
          data: insertPayload,
          error: state.insertError ?? null,
        }).then(resolve);
      }
      return Promise.resolve({ data: state.rows ?? [], error: state.error ?? null }).then(
        resolve,
      );
    },
  };

  return builder;
}

const mockClient = { from: (table: string) => builderFor(table) };

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockClient,
}));

let serviceConfigured = true;

vi.mock("@/lib/supabase/config", () => ({
  get IP_HASH_SALT() {
    return "test-salt";
  },
  isServiceRoleConfigured: () => serviceConfigured,
  isSupabaseConfigured: () => true,
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  missingSupabaseEnv: () => [],
}));

const { POST } = await import("@/app/api/survey/submit/route");

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

const SURVEY_ID = "11111111-1111-1111-1111-111111111111";
const SCHOOL_ID = "22222222-2222-2222-2222-222222222222";
const RESPONSE_ID = "33333333-3333-3333-3333-333333333333";

function validAnswers(): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const q of allQuestions) {
    if (q.options?.length) answers[String(q.entry_id)] = q.options[0]!;
    else if (q.type === "paragraph") answers[String(q.entry_id)] = "A considered answer.";
    else answers[String(q.entry_id)] = "Alice Uwase";
  }
  return answers;
}

function request(body: unknown): NextRequest {
  return new Request("http://localhost/api/survey/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.7" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

function happyPath() {
  tables.surveys = { single: { id: SURVEY_ID, status: "active", title: "Baseline" } };
  tables.questions = {
    rows: allQuestions.map((q) => ({
      id: `q-${q.entry_id}`,
      entry_id: q.entry_id,
      type: q.type,
      options: q.options ?? null,
      is_required: q.required,
    })),
  };
  tables.schools = { single: { id: SCHOOL_ID } };
  tables.survey_responses = { single: { id: RESPONSE_ID } };
  tables.answers = {};
}

beforeEach(() => {
  serviceConfigured = true;
  for (const key of Object.keys(tables)) delete tables[key];
  calls.length = 0;
  happyPath();
});

/* ------------------------------------------------------------------ *
 * Tests
 * ------------------------------------------------------------------ */

describe("configuration honesty", () => {
  it("returns 503 and says so when the service role key is missing", async () => {
    serviceConfigured = false;
    const response = await POST(
      request({ surveySlug: "x", email: "a@b.co", answers: validAnswers() }),
    );
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toMatch(/not connected to a database/i);
  });
});

describe("accepting a valid submission", () => {
  it("stores the response and one answer per question", async () => {
    const response = await POST(
      request({
        surveySlug: "plp-survey-1-baseline-term-1",
        email: "student@example.org",
        answers: validAnswers(),
      }),
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.answersStored).toBe(28);
  });

  it("links every answer to its response and its question", async () => {
    await POST(
      request({
        surveySlug: "plp-survey-1-baseline-term-1",
        email: "student@example.org",
        answers: validAnswers(),
      }),
    );

    const insert = calls.find((c) => c.table === "answers" && c.op === "insert");
    expect(insert).toBeDefined();

    const rows = insert!.payload as Array<{
      response_id: string;
      question_id: string;
      entry_id: number;
      answer_text: string;
    }>;

    expect(rows).toHaveLength(28);
    for (const row of rows) {
      expect(row.response_id).toBe(RESPONSE_ID);
      expect(row.question_id).toBe(`q-${row.entry_id}`);
      expect(row.answer_text.length).toBeGreaterThan(0);
    }

    // Every original entry id is represented exactly once.
    const ids = rows.map((r) => r.entry_id).sort((a, b) => a - b);
    const expected = allQuestions.map((q) => q.entry_id).sort((a, b) => a - b);
    expect(ids).toEqual(expected);
  });

  it("stores choice answers as the exact original option string", async () => {
    const answers = validAnswers();
    const rating = allQuestions.find((q) => q.options?.length === 5)!;
    answers[String(rating.entry_id)] = rating.options![2]!;

    await POST(
      request({
        surveySlug: "plp-survey-1-baseline-term-1",
        email: "student@example.org",
        answers,
      }),
    );

    const rows = calls.find((c) => c.table === "answers")!.payload as Array<{
      entry_id: number;
      answer_text: string;
    }>;
    const stored = rows.find((r) => r.entry_id === rating.entry_id)!;

    expect(stored.answer_text).toBe("3 — Neutral / Sometimes");
    expect(stored.answer_text).not.toBe("3");
  });

  it("derives the denormalised columns from the validated answers", async () => {
    const answers = validAnswers();
    answers[String(nameQuestion.entry_id)] = "Alice Uwase";
    answers[String(schoolQuestion.entry_id)] = schoolQuestion.options![17]!;
    answers[String(yearLevelQuestion.entry_id)] = "S4";

    await POST(
      request({
        surveySlug: "plp-survey-1-baseline-term-1",
        email: "student@example.org",
        answers,
      }),
    );

    const payload = calls.find(
      (c) => c.table === "survey_responses" && c.op === "insert",
    )!.payload as Record<string, unknown>;

    expect(payload.full_name).toBe("Alice Uwase");
    expect(payload.school_name).toBe("Collège de l'Immaculée Conception");
    expect(payload.year_level).toBe("S4");
    expect(payload.school_id).toBe(SCHOOL_ID);
    expect(payload.survey_id).toBe(SURVEY_ID);
  });

  it("stores a hashed IP, never the raw address", async () => {
    await POST(
      request({
        surveySlug: "plp-survey-1-baseline-term-1",
        email: "student@example.org",
        answers: validAnswers(),
      }),
    );

    const payload = calls.find(
      (c) => c.table === "survey_responses" && c.op === "insert",
    )!.payload as Record<string, unknown>;

    expect(payload.ip_hash).toBeTypeOf("string");
    expect(payload.ip_hash).not.toContain("203.0.113.7");
    expect(String(payload.ip_hash)).toHaveLength(32);
  });
});

describe("rejecting invalid submissions", () => {
  it("rejects a missing required answer with 422", async () => {
    const answers = validAnswers();
    delete answers[String(nameQuestion.entry_id)];

    const response = await POST(
      request({
        surveySlug: "plp-survey-1-baseline-term-1",
        email: "student@example.org",
        answers,
      }),
    );

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.issues.length).toBeGreaterThan(0);
  });

  it("rejects an option that is not in the source, even if the client sent it", async () => {
    const answers = validAnswers();
    const rating = allQuestions.find((q) => q.options?.length === 5)!;
    answers[String(rating.entry_id)] = "5 — Totally Agree";

    const response = await POST(
      request({
        surveySlug: "plp-survey-1-baseline-term-1",
        email: "student@example.org",
        answers,
      }),
    );

    expect(response.status).toBe(422);
    // Nothing was written.
    expect(calls.some((c) => c.op === "insert")).toBe(false);
  });

  it("rejects a school that is not on the original list", async () => {
    const answers = validAnswers();
    answers[String(schoolQuestion.entry_id)] = "Fake School";

    const response = await POST(
      request({
        surveySlug: "plp-survey-1-baseline-term-1",
        email: "student@example.org",
        answers,
      }),
    );
    expect(response.status).toBe(422);
  });

  it("requires a valid email", async () => {
    const response = await POST(
      request({
        surveySlug: "plp-survey-1-baseline-term-1",
        email: "not-an-email",
        answers: validAnswers(),
      }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects malformed JSON", async () => {
    const bad = new Request("http://localhost/api/survey/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    }) as unknown as NextRequest;

    const response = await POST(bad);
    expect(response.status).toBe(400);
  });

  it("refuses when the survey is closed", async () => {
    tables.surveys = { single: { id: SURVEY_ID, status: "closed", title: "Baseline" } };

    const response = await POST(
      request({
        surveySlug: "plp-survey-1-baseline-term-1",
        email: "student@example.org",
        answers: validAnswers(),
      }),
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/closed/i);
  });

  it("refuses when the survey has not been seeded", async () => {
    tables.surveys = { single: null };
    const response = await POST(
      request({
        surveySlug: "missing-survey",
        email: "student@example.org",
        answers: validAnswers(),
      }),
    );
    expect(response.status).toBe(404);
  });

  it("refuses when the seeded question count does not match the source", async () => {
    tables.questions = {
      rows: allQuestions.slice(0, 10).map((q) => ({
        id: `q-${q.entry_id}`,
        entry_id: q.entry_id,
        type: q.type,
        options: q.options ?? null,
        is_required: q.required,
      })),
    };

    const response = await POST(
      request({
        surveySlug: "plp-survey-1-baseline-term-1",
        email: "student@example.org",
        answers: validAnswers(),
      }),
    );

    expect(response.status).toBe(500);
    expect((await response.json()).error).toMatch(/does not match the published survey/i);
  });

  it("reports a duplicate submission clearly", async () => {
    tables.survey_responses = {
      single: null,
      insertError: { message: "duplicate key value", code: "23505" },
    };

    const response = await POST(
      request({
        surveySlug: "plp-survey-1-baseline-term-1",
        email: "student@example.org",
        answers: validAnswers(),
      }),
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/already been submitted with this email/i);
  });
});

describe("no partial submissions", () => {
  it("rolls the response back when the answers fail to insert", async () => {
    tables.answers = { insertError: { message: "insert failed" } };

    const response = await POST(
      request({
        surveySlug: "plp-survey-1-baseline-term-1",
        email: "student@example.org",
        answers: validAnswers(),
      }),
    );

    expect(response.status).toBe(502);
    // The orphaned response row is deleted rather than left behind.
    expect(
      calls.some((c) => c.table === "survey_responses" && c.op === "delete"),
    ).toBe(true);
  });
});
