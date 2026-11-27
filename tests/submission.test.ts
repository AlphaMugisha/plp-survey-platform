/**
 * Submission endpoint: server-side validation, answer relationships and the
 * rollback path. Supabase is mocked so the route's own logic is what is tested.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { allQuestions, sourceQuestions } from "@/lib/survey/source";

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
const CUSTOM_ENTRY_ID =
  Math.max(...sourceQuestions.map((question) => question.entry_id)) + 1;

function validAnswers(): Record<string, string> {
  return {};
}

function customQuestion(options = ["Yes", "No"]) {
  return {
    id: `q-${CUSTOM_ENTRY_ID}`,
    entry_id: CUSTOM_ENTRY_ID,
    order_index: 3,
    title: "Would you like to join?",
    description: null,
    type: "multiple_choice",
    options,
    is_required: true,
    is_custom: true,
  };
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
    rows: [],
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
      request({
        surveySlug: "x",
        email: "a@b.co",
        countryOfOrigin: "Rwanda",
        answers: validAnswers(),
      }),
    );
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toMatch(/not connected to a database/i);
  });
});

describe("accepting a valid submission", () => {
  it("stores the response when no questions have been added yet", async () => {
    const response = await POST(
      request({
        surveySlug: "plp-survey-1-baseline-term-1",
        email: "student@example.org",
        countryOfOrigin: "Rwanda",
        answers: validAnswers(),
      }),
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.answersStored).toBe(0);
  });

  it("does not create answer rows when there are no questions", async () => {
    await POST(
      request({
        surveySlug: "plp-survey-1-baseline-term-1",
        email: "student@example.org",
        countryOfOrigin: "Rwanda",
        answers: validAnswers(),
      }),
    );

    expect(calls.some((c) => c.table === "answers" && c.op === "insert")).toBe(false);
  });

  it("stores admin-added choice answers with the selected option", async () => {
    tables.questions = { rows: [customQuestion()] };
    const answers = { [String(CUSTOM_ENTRY_ID)]: "No" };

    await POST(
      request({
        surveySlug: "plp-survey-1-baseline-term-1",
        email: "student@example.org",
        countryOfOrigin: "Rwanda",
        answers,
      }),
    );

    const rows = calls.find((c) => c.table === "answers")!.payload as Array<{
      entry_id: number;
      answer_text: string;
    }>;
    const stored = rows.find((r) => r.entry_id === CUSTOM_ENTRY_ID)!;

    expect(stored.answer_text).toBe("No");
  });

  it("derives the denormalised columns from the validated answers", async () => {
    const answers = validAnswers();
    await POST(
      request({
        surveySlug: "plp-survey-1-baseline-term-1",
        email: "student@example.org",
        countryOfOrigin: "Rwanda",
        answers,
      }),
    );

    const payload = calls.find(
      (c) => c.table === "survey_responses" && c.op === "insert",
    )!.payload as Record<string, unknown>;

    // The applicant's name now comes from a question the admin wrote, so the
    // denormalised column has nothing to read.
    expect(payload.full_name).toBe("Not provided");
    expect(payload.year_level).toBe("");

    // The school is not asked, but this deployment declares exactly one, so it
    // is recorded anyway — otherwise every response would be unattributed and
    // the dashboard's school filter would be useless.
    expect(payload.school_name).toBe("New Generation Academy");
    expect(payload.country_of_origin).toBe("Rwanda");
    expect(payload.survey_id).toBe(SURVEY_ID);
  });

  it("stores a hashed IP, never the raw address", async () => {
    await POST(
      request({
        surveySlug: "plp-survey-1-baseline-term-1",
        email: "student@example.org",
        countryOfOrigin: "Rwanda",
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
    tables.questions = { rows: [customQuestion()] };
    const answers = validAnswers();

    const response = await POST(
      request({
        surveySlug: "plp-survey-1-baseline-term-1",
        email: "student@example.org",
        countryOfOrigin: "Rwanda",
        answers,
      }),
    );

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.issues.length).toBeGreaterThan(0);
  });

  it("rejects a choice outside the admin question options", async () => {
    tables.questions = { rows: [customQuestion()] };
    const answers = validAnswers();
    answers[String(CUSTOM_ENTRY_ID)] = "Maybe";

    const response = await POST(
      request({
        surveySlug: "plp-survey-1-baseline-term-1",
        email: "student@example.org",
        countryOfOrigin: "Rwanda",
        answers,
      }),
    );

    expect(response.status).toBe(422);
    // Nothing was written.
    expect(calls.some((c) => c.op === "insert")).toBe(false);
  });

  it("rejects answers to withheld source questions", async () => {
    const answers = validAnswers();
    // A question from the verified form that this deployment does not ask.
    answers[String(sourceQuestions[0]!.entry_id)] = "Old question answer";

    const response = await POST(
      request({
        surveySlug: "plp-survey-1-baseline-term-1",
        email: "student@example.org",
        countryOfOrigin: "Rwanda",
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
        countryOfOrigin: "Rwanda",
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
        countryOfOrigin: "Rwanda",
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
        countryOfOrigin: "Rwanda",
        answers: validAnswers(),
      }),
    );
    expect(response.status).toBe(404);
  });

  it("accepts submissions after the original questions are cleared", async () => {
    const response = await POST(
      request({
        surveySlug: "plp-survey-1-baseline-term-1",
        email: "student@example.org",
        countryOfOrigin: "Rwanda",
        answers: validAnswers(),
      }),
    );

    expect(response.status).toBe(201);
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
        countryOfOrigin: "Rwanda",
        answers: validAnswers(),
      }),
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/already been submitted with this email/i);
  });
});

describe("no partial submissions", () => {
  it("rolls the response back when the answers fail to insert", async () => {
    tables.questions = { rows: [customQuestion()] };
    tables.answers = { insertError: { message: "insert failed" } };

    const response = await POST(
      request({
        surveySlug: "plp-survey-1-baseline-term-1",
        email: "student@example.org",
        countryOfOrigin: "Rwanda",
        answers: { [String(CUSTOM_ENTRY_ID)]: "Yes" },
      }),
    );

    expect(response.status).toBe(502);
    // The orphaned response row is deleted rather than left behind.
    expect(
      calls.some((c) => c.table === "survey_responses" && c.op === "delete"),
    ).toBe(true);
  });
});
