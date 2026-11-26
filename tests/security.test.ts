/**
 * RLS and schema-integrity checks.
 *
 * These assert the POLICY AND CONSTRAINT DEFINITIONS in the migration files.
 * They catch the realistic failure mode — a policy or cascade quietly removed
 * or weakened in review — without needing a live database.
 *
 * NOTE ON SCOPE, stated plainly: this is static analysis of SQL, not a live
 * permission test. It cannot prove Postgres enforces these at runtime. Proving
 * that requires running the migrations against a real Supabase project and
 * attempting the denied reads/writes with an anon key; see SETUP.md.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "supabase", "migrations");
const read = (file: string) => readFileSync(join(dir, file), "utf8");

const schemaSql = read("20260101000100_schema.sql");
const rlsSql = read("20260101000200_rls.sql");
const adminSql = read("20260101000500_admin_setup.sql");
const grantsSql = read("20260101000600_privileges.sql");

/** Collapse whitespace so assertions survive reformatting. */
const flat = (sql: string) => sql.replace(/\s+/gu, " ");
const schemaFlat = flat(schemaSql);
const rlsFlat = flat(rlsSql);
const adminFlat = flat(adminSql);
const grantsFlat = flat(grantsSql);

const ALL_TABLES = [
  "schools",
  "surveys",
  "survey_sections",
  "questions",
  "survey_responses",
  "answers",
  "admin_profiles",
];

describe("row level security is enabled everywhere", () => {
  it.each(ALL_TABLES)("enables RLS on %s", (table) => {
    expect(rlsFlat).toContain(`alter table public.${table} enable row level security`);
  });
});

describe("participants cannot touch response data", () => {
  it("defines no INSERT policy on survey_responses or answers", () => {
    // Submissions go through the server route with the service-role key.
    expect(rlsFlat).not.toMatch(/create policy[^;]*on public\.survey_responses for insert/u);
    expect(rlsFlat).not.toMatch(/create policy[^;]*on public\.answers for insert/u);
  });

  it("grants no anon role any policy over response data", () => {
    // Split into individual policy statements first — a single regex across the
    // whole file would span from one policy into the next.
    const policies = rlsSql
      .split(/create policy/gu)
      .slice(1)
      .map((block) => `create policy${block.split(";")[0]};`);

    const responsePolicies = policies.filter((p) => p.includes("on public.survey_responses"));
    const answerPolicies = policies.filter((p) => p.includes("on public.answers"));

    expect(responsePolicies.length).toBeGreaterThan(0);
    expect(answerPolicies.length).toBeGreaterThan(0);

    for (const policy of [...responsePolicies, ...answerPolicies]) {
      expect(policy, policy).not.toMatch(/to\s+anon/u);
    }
  });

  it("revokes write privileges from anon and authenticated as defence in depth", () => {
    expect(rlsFlat).toContain(
      "revoke insert, update, delete on public.survey_responses from anon, authenticated",
    );
    expect(rlsFlat).toContain(
      "revoke insert, update, delete on public.answers from anon, authenticated",
    );
    expect(rlsFlat).toContain("revoke select on public.survey_responses from anon");
    expect(rlsFlat).toContain("revoke select on public.answers from anon");
  });

  it("restricts reading responses and answers to active administrators", () => {
    expect(rlsFlat).toMatch(
      /create policy survey_responses_admin_read on public\.survey_responses for select to authenticated using \(public\.is_active_admin\(\)\)/u,
    );
    expect(rlsFlat).toMatch(
      /create policy answers_admin_read on public\.answers for select to authenticated using \(public\.is_active_admin\(\)\)/u,
    );
  });
});

describe("participants can still read the survey they need to fill in", () => {
  it("lets anon read active surveys, their sections, questions and schools", () => {
    expect(rlsFlat).toMatch(
      /create policy surveys_public_read_active on public\.surveys for select to anon, authenticated using \(status = 'active'\)/u,
    );
    for (const table of ["survey_sections", "questions"]) {
      expect(rlsFlat).toMatch(
        new RegExp(`on public\\.${table} for select to anon, authenticated`, "u"),
      );
    }
    expect(rlsFlat).toMatch(
      /create policy schools_public_read on public\.schools for select to anon, authenticated/u,
    );
  });

  it("does not expose draft or closed surveys publicly", () => {
    const publicSurveyPolicy = rlsSql.match(
      /create policy surveys_public_read_active[\s\S]*?;/u,
    )?.[0];
    expect(publicSurveyPolicy).toBeDefined();
    expect(publicSurveyPolicy).toContain("status = 'active'");
  });
});

describe("administrator access is allow-list based", () => {
  it("checks an ACTIVE admin_profiles row, not merely being signed in", () => {
    expect(rlsFlat).toMatch(
      /create or replace function public\.is_active_admin\(\)[\s\S]*?from public\.admin_profiles p where p\.id = auth\.uid\(\) and p\.is_active/u,
    );
  });

  it("uses SECURITY DEFINER with a pinned search_path on the policy helpers", () => {
    for (const fn of ["is_active_admin", "has_admin_role", "can_manage_surveys"]) {
      const definition = rlsSql.match(
        new RegExp(`create or replace function public\\.${fn}[\\s\\S]*?\\$\\$;`, "u"),
      )?.[0];
      expect(definition, `${fn} should be defined`).toBeDefined();
      expect(definition).toContain("security definer");
      expect(definition).toContain("set search_path = ''");
    }
  });

  it("offers no public administrator registration", () => {
    expect(rlsFlat).toContain("revoke all on public.admin_profiles from anon");
    // Only an owner may change the allow-list.
    expect(rlsFlat).toMatch(
      /create policy admin_profiles_owner_manage on public\.admin_profiles for all to authenticated using \(public\.has_admin_role\(array\['owner'\]/u,
    );
    // No policy lets a user create their own admin profile.
    expect(rlsFlat).not.toMatch(/with check \(id = auth\.uid\(\)\)/u);
  });

  it("requires the service role or an existing owner to grant admin rights", () => {
    expect(adminFlat).toContain("if not public.can_manage_admins() then");
    expect(adminFlat).toMatch(
      /coalesce\(jwt_role, current_user\) in \('service_role', 'postgres', 'supabase_admin'\)/u,
    );
    expect(adminFlat).toContain("revoke all on function public.grant_admin");
  });

  it("refuses to deactivate the last active owner", () => {
    expect(adminFlat).toContain("Refusing to deactivate the last active owner");
  });

  it("makes the reporting view respect the caller's RLS", () => {
    // Without security_invoker a view runs as its owner and bypasses RLS.
    expect(rlsFlat).toContain("create or replace view public.admin_response_overview with (security_invoker = true)");
    expect(rlsFlat).toContain("revoke all on public.admin_response_overview from anon");
  });
});

describe("table privileges are granted explicitly", () => {
  // Postgres needs BOTH a GRANT (may this role touch the table?) and an RLS
  // policy (which rows?). Relying on a project-level ALTER DEFAULT PRIVILEGES
  // produced "42501: permission denied for table surveys" on a new project
  // even with correct policies, so the grants are now stated outright.

  it("grants the service role full access for the submission route", () => {
    expect(grantsFlat).toContain(
      "grant all privileges on all tables in schema public to service_role",
    );
  });

  it("grants anon read access to the public survey content it must render", () => {
    for (const table of ["schools", "surveys", "survey_sections", "questions"]) {
      expect(grantsFlat).toContain(`grant select on public.${table} to anon, authenticated`);
    }
  });

  it("revokes everything on response data from anon", () => {
    expect(grantsFlat).toContain("revoke all on public.survey_responses from anon");
    expect(grantsFlat).toContain("revoke all on public.answers from anon");
    expect(grantsFlat).toContain("revoke all on public.admin_profiles from anon");
    expect(grantsFlat).toContain("revoke all on public.admin_response_overview from anon");
  });

  it("stops even signed-in users writing responses or answers directly", () => {
    expect(grantsFlat).toContain(
      "revoke insert, update on public.survey_responses from authenticated",
    );
    expect(grantsFlat).toContain(
      "revoke insert, update, delete on public.answers from authenticated",
    );
  });

  it("revokes come after the broad grants so they win", () => {
    const firstRevoke = grantsSql.indexOf("revoke all on public.survey_responses");
    const lastBroadGrant = grantsSql.lastIndexOf("grant select on public.answers");
    expect(firstRevoke).toBeGreaterThan(lastBroadGrant);
  });

  it("self-checks the resulting privileges and fails loudly", () => {
    expect(grantsFlat).toContain("raise exception 'Privilege check failed:%'");
    expect(grantsFlat).toContain("UNEXPECTED:anon-can-select-responses");
  });
});

describe("no orphaned answers", () => {
  it("cascades answers when their response is deleted", () => {
    expect(schemaFlat).toContain(
      "response_id uuid not null references public.survey_responses (id) on delete cascade",
    );
  });

  it("restricts deleting a question that has answers", () => {
    expect(schemaFlat).toContain(
      "question_id uuid not null references public.questions (id) on delete restrict",
    );
  });

  it("restricts deleting a survey that has responses", () => {
    expect(schemaFlat).toContain(
      "survey_id uuid not null references public.surveys (id) on delete restrict",
    );
  });

  it("requires both foreign keys and a non-blank answer", () => {
    expect(schemaFlat).toContain("constraint answers_text_not_blank check (length(btrim(answer_text)) > 0)");
  });

  it("allows only one answer per question per response", () => {
    expect(schemaFlat).toContain(
      "constraint answers_one_per_question unique (response_id, question_id)",
    );
  });
});

describe("answer integrity is enforced in the database", () => {
  it("rejects an answer that is not one of its question's original options", () => {
    expect(schemaFlat).toContain("create or replace function public.answers_validate_option()");
    expect(schemaFlat).toContain("is not one of the allowed options for question");
    expect(schemaFlat).toContain("create trigger answers_validate_option_trg");
  });

  it("keeps the denormalised entry_id in step with the question", () => {
    expect(schemaFlat).toContain("create trigger answers_sync_entry_id_trg");
  });

  it("makes submitted answers append-only", () => {
    expect(schemaFlat).toContain("Submitted answers are append-only and cannot be modified");
    expect(schemaFlat).toContain("create trigger answers_append_only");
  });

  it("stores options as a JSON array of strings, never numbers", () => {
    expect(schemaFlat).toContain("constraint questions_options_shape check");
    expect(schemaFlat).toContain("where jsonb_typeof(e) <> 'string'");
    // The test lives in an IMMUTABLE function the constraint calls.
    expect(schemaFlat).toContain(
      "create or replace function public.jsonb_is_string_array(v jsonb)",
    );
    expect(schemaFlat).toContain(
      "constraint questions_options_shape check (public.jsonb_is_string_array(options))",
    );
  });

  it("uses no subquery inside a CHECK constraint", () => {
    // Postgres rejects these outright: "cannot use subquery in check constraint".
    // Scan every CHECK body by balancing parentheses.
    const offenders: string[] = [];

    for (const match of schemaSql.matchAll(/check\s*\(/giu)) {
      const start = match.index! + match[0].length - 1;
      let depth = 0;
      let end = start;
      for (let i = start; i < schemaSql.length; i += 1) {
        if (schemaSql[i] === "(") depth += 1;
        else if (schemaSql[i] === ")") {
          depth -= 1;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      const body = schemaSql.slice(start, end + 1);
      if (/\bselect\b/iu.test(body)) {
        offenders.push(body.replace(/\s+/gu, " ").slice(0, 120));
      }
    }

    expect(offenders, `CHECK constraints containing a subquery:\n${offenders.join("\n")}`)
      .toEqual([]);
  });
});

describe("the baseline survey becomes immutable", () => {
  it("guards surveys, sections and questions once responses exist", () => {
    expect(schemaFlat).toContain("create or replace function public.guard_survey_immutable()");
    expect(schemaFlat).toContain(
      "create or replace function public.guard_survey_child_immutable()",
    );
    for (const trigger of [
      "surveys_guard_immutable",
      "survey_sections_guard_immutable",
      "questions_guard_immutable",
    ]) {
      expect(schemaFlat).toContain(`create trigger ${trigger}`);
    }
  });

  it("gives surveys and its child tables separate trigger functions", () => {
    // `surveys` has `id`; `survey_sections`/`questions` have `survey_id`.
    // PL/pgSQL resolves field references against the real record type, so one
    // shared function touching both fails with
    // "record new has no field survey_id" — even inside an untaken CASE branch.
    const bodyOf = (fn: string) =>
      schemaSql.match(
        new RegExp(`create or replace function public\\.${fn}\\(\\)[\\s\\S]*?\\$\\$;`, "u"),
      )?.[0] ?? "";

    const surveysFn = bodyOf("guard_survey_immutable");
    const childFn = bodyOf("guard_survey_child_immutable");

    expect(surveysFn).not.toBe("");
    expect(childFn).not.toBe("");

    // The surveys guard must never reference survey_id...
    expect(surveysFn).not.toMatch(/\b(new|old)\.survey_id\b/u);
    // ...and the child guard must never reference a bare .id as the survey key.
    expect(childFn).toMatch(/\bold\.survey_id\b/u);
    expect(childFn).toMatch(/\bnew\.survey_id\b/u);
    expect(childFn).not.toMatch(/\b(new|old)\.id\b/u);
  });

  it("drops the previous single-function guard so a re-run is clean", () => {
    expect(schemaFlat).toContain(
      "drop function if exists public.guard_survey_content_immutable()",
    );
  });

  it("explains that a new survey is the correct path", () => {
    expect(schemaFlat).toMatch(/Create a new survey instead/u);
  });

  it("handles INSERT and DELETE without touching an unassigned record", () => {
    // OLD is unassigned on INSERT and NEW on DELETE; the guard must branch first.
    expect(schemaFlat).toContain(
      "if tg_op = 'DELETE' then target_survey := old.survey_id; else target_survey := new.survey_id; end if;",
    );
  });
});

describe("indexes and uniqueness", () => {
  it("indexes the columns the dashboard filters and sorts on", () => {
    for (const index of [
      "survey_responses_survey_submitted_idx",
      "survey_responses_school_idx",
      "survey_responses_year_level_idx",
      "answers_response_idx",
      "answers_question_idx",
      "questions_survey_order_idx",
    ]) {
      expect(schemaFlat).toContain(index);
    }
  });

  it("keeps original entry ids and ordering unique per survey", () => {
    expect(schemaFlat).toContain("constraint questions_entry_unique unique (survey_id, entry_id)");
    expect(schemaFlat).toContain("constraint questions_order_unique unique (survey_id, order_index)");
  });

  it("keeps school names and their original order unique", () => {
    expect(schemaFlat).toContain("constraint schools_name_unique unique (name)");
    expect(schemaFlat).toContain("constraint schools_display_order_unique unique (display_order)");
  });

  it("allows one response per email per survey", () => {
    expect(schemaFlat).toContain(
      "create unique index if not exists survey_responses_one_per_email_idx on public.survey_responses (survey_id, lower(btrim(email)))",
    );
  });

  it("never stores a raw IP, only a hash column", () => {
    expect(schemaFlat).toContain("ip_hash text");
    expect(schemaFlat).not.toMatch(/\bip_address\b/u);
  });
});
