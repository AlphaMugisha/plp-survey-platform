/**
 * Generates the seed migrations directly from `data/survey-source.json`.
 *
 *   npm run generate:migrations
 *
 * Writes:
 *   supabase/migrations/20260101000300_seed_schools.sql          — all 180 original schools
 *   supabase/migrations/20260101000400_seed_survey_baseline.sql  — survey, 5 sections, 28 questions
 *
 * Survey content is NEVER hand-written into SQL. Regenerating after a source
 * change produces the new SQL; `npm run verify:survey` then proves the app and
 * the source still agree.
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const migrationsDir = join(root, "supabase", "migrations");

type Item = {
  index: number;
  type: "short_answer" | "paragraph" | "multiple_choice" | "dropdown" | "section_header";
  title: string;
  description: string | null;
  entry_id?: number;
  required?: boolean;
  options?: string[];
};

type Source = {
  source_url: string;
  form_title: string;
  header_description: string;
  confirmation_message: string;
  collects_email: { enabled: boolean; required: boolean };
  items: Item[];
};

const SURVEY_SLUG = "plp-survey-1-baseline-term-1";

/* ---------------- SQL literal helpers ---------------- */

/** Single-quoted SQL text literal with quotes doubled. Handles newlines/accents. */
function sql(value: string): string {
  return `'${value.replace(/'/gu, "''")}'`;
}

function sqlNullable(value: string | null | undefined): string {
  return value === null || value === undefined ? "null" : sql(value);
}

/** JSON array of exact option strings, cast to jsonb. */
function sqlJsonb(values: string[]): string {
  return `${sql(JSON.stringify(values))}::jsonb`;
}

function sqlBool(value: boolean): string {
  return value ? "true" : "false";
}

/* ---------------- Load source ---------------- */

const sourcePath = join(root, "data", "survey-source.json");
const source: Source = JSON.parse(readFileSync(sourcePath, "utf8"));

const schools = source.items.find((i) => i.type === "dropdown")?.options ?? [];
if (schools.length === 0) throw new Error("No school options found in source.");

/* ---------------- seed schools ---------------- */

const schoolRows = schools
  .map((name, i) => `  (${sql(name)}, ${i})`)
  .join(",\n");

const schoolsSql = `-- =============================================================================
-- PLP Survey Platform — school seed data
-- Migration 20260101000300  (GENERATED — do not edit by hand)
--
-- Generated from data/survey-source.json by: npm run generate:migrations
-- Source form: ${source.source_url}
--
-- ${schools.length} schools, reproduced VERBATIM from the original Google Form
-- dropdown. Original casing, accents, punctuation and spelling are preserved
-- exactly as they appear in the source form — including inconsistent casing and
-- apparent typos, which are authoritative values and must not be "corrected".
-- display_order preserves the original dropdown ordering.
-- =============================================================================

insert into public.schools (name, display_order) values
${schoolRows}
on conflict (name) do nothing;

-- Sanity check: fail the migration loudly if the count drifts.
do $check$
declare
  n integer;
begin
  select count(*) into n from public.schools;
  if n <> ${schools.length} then
    raise exception
      'Expected ${schools.length} schools after seeding, found %. School list is incomplete.', n;
  end if;
end
$check$;
`;

/* ---------------- seed survey, sections, questions ---------------- */

type SectionSeed = {
  order: number;
  title: string;
  description: string | null;
  shortLabel: string;
  plainTitle: string;
};

const sections: SectionSeed[] = [];
// questions in original order, with the owning section order (null = participant details)
const questions: Array<{ item: Item; sectionOrder: number | null }> = [];

let currentSectionOrder: number | null = null;
for (const item of source.items) {
  if (item.type === "section_header") {
    const match = /^SECTION\s+([A-Z0-9]+)\s*—\s*(.*)$/u.exec(item.title);
    const order = sections.length + 1;
    sections.push({
      order,
      title: item.title,
      description: item.description,
      shortLabel: match?.[1] ?? String(order),
      plainTitle: match?.[2] ?? item.title,
    });
    currentSectionOrder = order;
    continue;
  }
  questions.push({ item, sectionOrder: currentSectionOrder });
}

const sectionBlocks = sections
  .map(
    (s) => `  insert into public.survey_sections
    (survey_id, order_index, title, description, short_label, plain_title)
  values
    (v_survey, ${s.order}, ${sql(s.title)}, ${sqlNullable(s.description)}, ${sql(s.shortLabel)}, ${sql(s.plainTitle)})
  on conflict (survey_id, order_index) do nothing;`,
  )
  .join("\n\n");

const questionBlocks = questions
  .map(({ item, sectionOrder }) => {
    const sectionExpr =
      sectionOrder === null
        ? "null"
        : `(select id from public.survey_sections where survey_id = v_survey and order_index = ${sectionOrder})`;
    const options = item.options ? sqlJsonb(item.options) : "null";
    return `  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     ${sectionExpr},
     ${item.entry_id},
     ${item.index},
     ${sql(item.title)},
     ${sqlNullable(item.description)},
     '${item.type}',
     ${options},
     ${sqlBool(item.required ?? false)})
  on conflict (survey_id, entry_id) do nothing;`;
  })
  .join("\n\n");

const questionCount = questions.length;
const requiredCount = questions.filter((q) => q.item.required).length;

const surveySql = `-- =============================================================================
-- PLP Survey Platform — baseline survey content
-- Migration 20260101000400  (GENERATED — do not edit by hand)
--
-- Generated from data/survey-source.json by: npm run generate:migrations
-- Source form: ${source.source_url}
--
-- ${sections.length} sections, ${questionCount} questions (${requiredCount} required,
-- ${questionCount - requiredCount} optional). Question wording, descriptions, answer options,
-- required flags, original Google entry ids and original ordering are all
-- reproduced verbatim from the source file.
--
-- Multiple-choice options are stored as the EXACT original strings
-- (e.g. '3 — Neutral / Sometimes'), never converted to numbers.
--
-- This block is idempotent: it only seeds content when the survey has no
-- questions yet, so it is safe to re-run after the survey has been locked.
-- =============================================================================

do $seed$
declare
  v_survey uuid;
begin
  insert into public.surveys
    (slug, title, description, confirmation_message, source_url,
     collects_email, email_required, status, version, published_at)
  values
    (${sql(SURVEY_SLUG)},
     ${sql(source.form_title)},
     ${sql(source.header_description)},
     ${sql(source.confirmation_message)},
     ${sql(source.source_url)},
     ${sqlBool(source.collects_email.enabled)},
     ${sqlBool(source.collects_email.required)},
     'active',
     1,
     now())
  on conflict (slug) do nothing;

  select id into v_survey from public.surveys where slug = ${sql(SURVEY_SLUG)};

  if v_survey is null then
    raise exception 'Failed to create or locate survey ${SURVEY_SLUG}';
  end if;

  -- Only seed content once. Re-running is a no-op.
  if exists (select 1 from public.questions where survey_id = v_survey) then
    raise notice 'Survey % already has questions — skipping content seed.', ${sql(SURVEY_SLUG)};
    return;
  end if;

  -- ------------------------------------------------------------------
  -- Sections (${sections.length})
  -- ------------------------------------------------------------------

${sectionBlocks}

  -- ------------------------------------------------------------------
  -- Questions (${questionCount}) — original form order preserved via order_index
  -- ------------------------------------------------------------------

${questionBlocks}

  -- Freeze the baseline instrument. Future surveys are new rows.
  update public.surveys set is_locked = true where id = v_survey;
end
$seed$;

-- =============================================================================
-- Post-seed verification — the migration fails if content does not match source
-- =============================================================================

do $check$
declare
  v_survey    uuid;
  n_sections  integer;
  n_questions integer;
  n_required  integer;
begin
  select id into v_survey from public.surveys where slug = ${sql(SURVEY_SLUG)};

  select count(*) into n_sections  from public.survey_sections where survey_id = v_survey;
  select count(*) into n_questions from public.questions       where survey_id = v_survey;
  select count(*) into n_required  from public.questions
    where survey_id = v_survey and is_required;

  if n_sections <> ${sections.length} then
    raise exception 'Expected ${sections.length} sections, found %', n_sections;
  end if;
  if n_questions <> ${questionCount} then
    raise exception 'Expected ${questionCount} questions, found %', n_questions;
  end if;
  if n_required <> ${requiredCount} then
    raise exception 'Expected ${requiredCount} required questions, found %', n_required;
  end if;

  raise notice 'Baseline survey verified: % sections, % questions (% required).',
    n_sections, n_questions, n_required;
end
$check$;
`;

/* ---------------- Write ---------------- */

mkdirSync(migrationsDir, { recursive: true });
writeFileSync(join(migrationsDir, "20260101000300_seed_schools.sql"), schoolsSql, "utf8");
writeFileSync(join(migrationsDir, "20260101000400_seed_survey_baseline.sql"), surveySql, "utf8");

console.log("Generated migrations from data/survey-source.json:");
console.log(`  20260101000300_seed_schools.sql          ${schools.length} schools`);
console.log(
  `  20260101000400_seed_survey_baseline.sql  ${sections.length} sections, ${questionCount} questions (${requiredCount} required, ${questionCount - requiredCount} optional)`,
);
