/**
 * Generate the migration that seeds the PLP Ishami application questionnaire.
 *
 *   node scripts/generate-application-seed.mjs
 *
 * Reads `data/application-questions.json` and writes the migration named below,
 * so the SQL and the reviewed JSON can never drift apart. Re-run it after
 * editing the JSON; never hand-edit the generated migration.
 *
 * Text is emitted as Postgres E'' strings with escaped newlines, because this
 * repository has been bitten before by CRLF sneaking into stored content. See
 * `.gitattributes` and migration 0007.
 */
import { readFileSync, writeFileSync } from "node:fs";

const MIGRATION = "supabase/migrations/20261127090000_seed_plp_ishami_application.sql";
const SLUG = "plp-survey-1-baseline-term-1";

const data = JSON.parse(readFileSync("data/application-questions.json", "utf8"));

/** A Postgres text literal with newlines escaped rather than embedded. */
function lit(value) {
  if (value === null || value === undefined) return "null";
  const escaped = String(value)
    .replace(/\\/gu, "\\\\")
    .replace(/'/gu, "''")
    .replace(/\r\n/gu, "\\n")
    .replace(/\r/gu, "\\n")
    .replace(/\n/gu, "\\n");
  return `E'${escaped}'`;
}

/** A jsonb array of strings, or null. */
function jsonbArray(options) {
  if (!options || options.length === 0) return "null";
  return `${lit(JSON.stringify(options))}::jsonb`;
}

const parts = data.parts;
const allQuestions = parts.flatMap((p) => p.questions);

// Entry ids must be unique, and must not collide with the verified Google Form
// (whose ids are all far larger). Checked here so a bad edit to the JSON fails
// at generation time rather than inside a migration.
const ids = allQuestions.map((q) => q.entryId);
const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
if (duplicates.length > 0) {
  throw new Error(`Duplicate entry id(s) in application-questions.json: ${duplicates.join(", ")}`);
}

const source = JSON.parse(readFileSync("data/survey-source.json", "utf8"));
const sourceIds = new Set(
  source.items.filter((i) => i.entry_id !== undefined).map((i) => i.entry_id),
);
const collisions = ids.filter((id) => sourceIds.has(id));
if (collisions.length > 0) {
  throw new Error(`Entry id(s) collide with the verified source form: ${collisions.join(", ")}`);
}

const lines = [];
const w = (s = "") => lines.push(s);

w("-- =============================================================================");
w("-- PLP Ishami — Membership Application & Family Questionnaire");
w("--");
w("-- GENERATED from data/application-questions.json by");
w("-- scripts/generate-application-seed.mjs. Do not edit by hand: re-run the");
w("-- generator instead, or edit the questions in the admin dashboard.");
w("--");
w(`-- Seeds ${parts.length} parts and ${allQuestions.length} questions.`);
w("--");
w("-- Every question is inserted with is_custom = true, so administrators keep");
w("-- full edit and remove rights over them. The questions from the verified");
w("-- Google Form are untouched by this migration — they stay in the database as");
w("-- an archive and are withheld from this deployment by data/deployment.json.");
w("--");
w("-- Idempotent: re-running replaces the seeded set as long as nobody has");
w("-- answered it, and refuses outright once there are responses.");
w("-- =============================================================================");
w();
w("do $seed$");
w("declare");
w("  v_survey  uuid;");
w("  v_locked  boolean;");
w("  v_section uuid;");
w("  v_order   integer := 0;");
w("begin");
w(`  select id, is_locked into v_survey, v_locked`);
w(`  from public.surveys where slug = ${lit(SLUG)};`);
w();
w("  if v_survey is null then");
w("    raise exception 'Survey % not found — run the seed migrations first.', " + lit(SLUG) + ";");
w("  end if;");
w();
w("  -- Replacing a question set would orphan answers already given.");
w("  if public.survey_has_responses(v_survey) then");
w("    raise exception");
w("      'This application already has responses: refusing to replace its questions. '");
w("      'Create a new survey instead.'");
w("      using errcode = 'check_violation';");
w("  end if;");
w();
w("  -- Sections and questions are immutable while the survey is locked.");
w("  update public.surveys set is_locked = false where id = v_survey;");
w();
w("  -- ---- Clear any previously seeded application content ----");
w("  -- Only admin-added rows: the archived source questions are left alone.");
w("  delete from public.questions");
w("   where survey_id = v_survey and is_custom = true;");
w();
w("  delete from public.survey_sections");
w("   where survey_id = v_survey and is_custom = true;");
w();

// Sections start after the Google Form's own sections so the unique
// (survey_id, order_index) constraint cannot collide with them.
w("  -- ---- Parts ----");
w("  -- Ordered after the archived source sections, so the unique index on");
w("  -- (survey_id, order_index) cannot collide with them.");
w("  select coalesce(max(order_index), 0) into v_order");
w("  from public.survey_sections where survey_id = v_survey;");
w();

parts.forEach((part, partIndex) => {
  w(`  -- ${part.title}`);
  w("  insert into public.survey_sections");
  w("    (survey_id, order_index, title, description, short_label, plain_title, is_custom)");
  w("  values");
  w(
    `    (v_survey, v_order + ${partIndex + 1}, ${lit(part.title)}, ${lit(part.description)},` +
      ` ${lit(part.shortLabel)}, ${lit(part.title)}, true)`,
  );
  w("  returning id into v_section;");
  w();

  for (const q of part.questions) {
    w("  insert into public.questions");
    w(
      "    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required, is_custom)",
    );
    w("  values");
    w(
      `    (v_survey, v_section, ${q.entryId}, ${q.entryId}, ${lit(q.title)}, null,` +
        ` ${lit(q.type)}, ${jsonbArray(q.options)}, ${q.required ? "true" : "false"}, true);`,
    );
    w();
  }
});

w("  update public.surveys set is_locked = coalesce(v_locked, true) where id = v_survey;");
w();
w(
  `  raise notice 'Seeded ${parts.length} part(s) and ${allQuestions.length} question(s) for the PLP Ishami application.';`,
);
w("end");
w("$seed$;");
w();
w("-- =============================================================================");
w("-- Verification");
w("-- =============================================================================");
w();
w("do $check$");
w("declare");
w("  v_survey   uuid;");
w("  n_sections integer;");
w("  n_questions integer;");
w("begin");
w(`  select id into v_survey from public.surveys where slug = ${lit(SLUG)};`);
w();
w("  select count(*) into n_sections");
w("  from public.survey_sections where survey_id = v_survey and is_custom = true;");
w();
w("  select count(*) into n_questions");
w("  from public.questions where survey_id = v_survey and is_custom = true;");
w();
w(`  if n_sections <> ${parts.length} then`);
w(`    raise exception 'Expected ${parts.length} parts, found %.', n_sections;`);
w("  end if;");
w();
w(`  if n_questions <> ${allQuestions.length} then`);
w(`    raise exception 'Expected ${allQuestions.length} questions, found %.', n_questions;`);
w("  end if;");
w();
w("  -- Every seeded question must sit in one of the seeded parts.");
w("  if exists (");
w("    select 1 from public.questions q");
w("    where q.survey_id = v_survey and q.is_custom = true and q.section_id is null");
w("  ) then");
w("    raise exception 'A seeded application question is not in any part.';");
w("  end if;");
w();
w("  -- No stored text may carry a carriage return (see migration 0007).");
w("  if exists (");
w("    select 1 from public.questions q");
w("    where q.survey_id = v_survey and q.is_custom = true");
w("      and (q.title like E'%\\r%' or coalesce(q.description, '') like E'%\\r%')");
w("  ) then");
w("    raise exception 'A seeded question contains a carriage return.';");
w("  end if;");
w();
w("  raise notice 'Verified: % part(s), % question(s), all grouped.', n_sections, n_questions;");
w("end");
w("$check$;");
w();

writeFileSync(MIGRATION, lines.join("\n"), "utf8");
console.log(
  `wrote ${MIGRATION}\n  ${parts.length} parts, ${allQuestions.length} questions, ` +
    `entry ids ${Math.min(...ids)}..${Math.max(...ids)}`,
);
