/**
 * Automated content verification.
 *
 *   npm run verify:survey            check, print a report, exit non-zero on failure
 *   npm run verify:survey -- --update  re-baseline the content fingerprint on purpose
 *
 * ---------------------------------------------------------------------------
 * WHAT IS COMPARED
 *
 * Layer 1 — source file -> application model
 *   `data/survey-source.json` is compared against `surveySteps` / `surveySections`
 *   / `allQuestions` from `src/lib/survey/source.ts` and `steps.ts`. Those are the
 *   exact objects the survey UI iterates over: the participant page renders
 *   `question.title`, `question.options`, `section.title` and
 *   `section.description` straight from them, so a mismatch here is a mismatch on
 *   screen. Every step's question list is walked, which also proves the guided
 *   multi-step layout neither drops, duplicates nor reorders a question.
 *
 * Layer 2 — source file -> database seed
 *   The generated migrations are parsed and checked to contain every section,
 *   question, entry id, option and school, so the UI and the database cannot
 *   drift apart.
 *
 * Layer 3 — content fingerprint
 *   A SHA-256 over the canonical content is compared with the committed
 *   baseline in `data/content-fingerprint.json`. Any unexpected change to
 *   wording, options, ordering or required flags fails the run, even if the
 *   structural checks still pass.
 *
 * Layer 4 (separate) — real DOM rendering
 *   `npm test` mounts the actual React components and asserts the same content
 *   appears in the rendered output. See `tests/content-rendering.test.tsx`.
 * ---------------------------------------------------------------------------
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  allQuestions,
  sourceQuestions,
  deployment,
  hasDeploymentOverrides,
  schools,
  scaleOptions,
  scaleQuestions,
  surveySections,
  surveySource,
  surveyStats,
} from "../src/lib/survey/source";
import { surveySteps } from "../src/lib/survey/steps";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

/* ------------------------------------------------------------------ *
 * Reporting
 * ------------------------------------------------------------------ */

type Check = { name: string; ok: boolean; detail?: string; info?: string };

const checks: Check[] = [];
let failures = 0;

function check(name: string, ok: boolean, detail?: string, info?: string) {
  checks.push({ name, ok, detail, info });
  if (!ok) failures += 1;
}

function eq<T>(name: string, actual: T, expected: T, info?: string) {
  const ok = actual === expected;
  check(name, ok, ok ? undefined : `expected ${String(expected)}, found ${String(actual)}`, info);
}

/* ------------------------------------------------------------------ *
 * Load the raw source independently of the app's loader
 * ------------------------------------------------------------------ */

type RawItem = {
  index: number;
  type: string;
  title: string;
  description: string | null;
  entry_id?: number;
  required?: boolean;
  options?: string[];
};

type RawSource = {
  form_title: string;
  header_description: string;
  confirmation_message: string;
  collects_email: { enabled: boolean; required: boolean };
  items: RawItem[];
};

const raw: RawSource = JSON.parse(
  readFileSync(join(root, "data", "survey-source.json"), "utf8"),
);

const rawSections = raw.items.filter((i) => i.type === "section_header");
const rawQuestions = raw.items.filter((i) => i.type !== "section_header");
const rawSchools = raw.items.find((i) => i.type === "dropdown")?.options ?? [];

/** The school list exactly as the source defines it, before any overlay. */
const sourceSchoolList = sourceQuestions.find((q) => q.type === "dropdown")?.options ?? [];

/* ================================================================== *
 * LAYER 1 — source file vs application model
 * ================================================================== */

// ---- Form-level text ----
eq("Form title matches source", surveySource.form_title, raw.form_title);
eq(
  "Header description matches source",
  surveySource.header_description,
  raw.header_description,
);
eq(
  "Confirmation message matches source",
  surveySource.confirmation_message,
  raw.confirmation_message,
);
eq(
  "Email collection enabled matches source",
  surveySource.collects_email.enabled,
  raw.collects_email.enabled,
);
eq(
  "Email collection required matches source",
  surveySource.collects_email.required,
  raw.collects_email.required,
);

// ---- Counts ----
eq("Section count", surveySections.length, rawSections.length, `${rawSections.length} sections`);
eq("Question count", sourceQuestions.length, rawQuestions.length, `${rawQuestions.length} questions`);
eq(
  "Required question count",
  sourceQuestions.filter((q) => q.required).length,
  rawQuestions.filter((q) => q.required).length,
);
eq(
  "Optional question count",
  sourceQuestions.filter((q) => !q.required).length,
  rawQuestions.filter((q) => !q.required).length,
);
eq("School count", sourceSchoolList.length, rawSchools.length, `${rawSchools.length} schools`);

// ---- Section titles and descriptions, exactly ----
rawSections.forEach((rawSection, i) => {
  const appSection = surveySections[i];
  if (!appSection) {
    check(`Section ${i + 1} present`, false, "missing from the application model");
    return;
  }
  eq(`Section ${i + 1} title exact`, appSection.title, rawSection.title);
  eq(`Section ${i + 1} description exact`, appSection.description, rawSection.description);
});

// ---- Question wording, ids, type, ordering, options, required flag ----
rawQuestions.forEach((rawQuestion, i) => {
  const appQuestion = sourceQuestions[i];
  const label = `Q${i + 1} (entry ${rawQuestion.entry_id})`;

  if (!appQuestion) {
    check(`${label} present`, false, "missing from the application model");
    return;
  }

  eq(`${label} wording exact`, appQuestion.title, rawQuestion.title);
  eq(`${label} help text exact`, appQuestion.description, rawQuestion.description);
  eq(`${label} original entry id`, appQuestion.entry_id, rawQuestion.entry_id);
  eq(`${label} type`, appQuestion.type, rawQuestion.type);
  eq(`${label} required flag`, appQuestion.required, rawQuestion.required);
  // order_index preserves the original payload position
  eq(`${label} original order`, appQuestion.index, rawQuestion.index);

  const rawOptions = rawQuestion.options ?? null;
  const appOptions = appQuestion.options ?? null;

  if (rawOptions === null) {
    check(`${label} has no options`, appOptions === null, "unexpected options present");
  } else if (appOptions === null) {
    check(`${label} options present`, false, "options missing from the application model");
  } else {
    eq(`${label} option count`, appOptions.length, rawOptions.length);
    const mismatch = rawOptions.findIndex((opt, k) => appOptions[k] !== opt);
    check(
      `${label} options exact & in order`,
      mismatch === -1,
      mismatch === -1
        ? undefined
        : `option ${mismatch + 1}: expected "${rawOptions[mismatch]}", found "${appOptions[mismatch]}"`,
    );
  }
});

// ---- School names, exactly and in order ----
{
  const mismatch = rawSchools.findIndex((name, i) => sourceSchoolList[i] !== name);
  check(
    "All school names exact & in original order",
    mismatch === -1,
    mismatch === -1
      ? undefined
      : `school ${mismatch + 1}: expected "${rawSchools[mismatch]}", found "${sourceSchoolList[mismatch]}"`,
    `${rawSchools.length} names compared`,
  );
}

// ---- The guided step layout must cover every question exactly once ----
{
  const stepped = surveySteps.flatMap((step) => step.questions.map((q) => q.entry_id));
  const expected = rawQuestions.map((q) => q.entry_id!);

  eq("Steps contain every question exactly once", stepped.length, expected.length);

  const dupes = stepped.filter((id, i) => stepped.indexOf(id) !== i);
  check(
    "No question appears in more than one step",
    dupes.length === 0,
    dupes.length === 0 ? undefined : `duplicated entry ids: ${dupes.join(", ")}`,
  );

  const orderOk = stepped.every((id, i) => id === expected[i]);
  check(
    "Step order preserves the original question order",
    orderOk,
    orderOk ? undefined : "the sequence of questions across steps differs from the source",
  );

  const missing = expected.filter((id) => !stepped.includes(id));
  check(
    "No question is dropped by the step layout",
    missing.length === 0,
    missing.length === 0 ? undefined : `missing entry ids: ${missing.join(", ")}`,
  );
}

// ---- The repeated scale ----
{
  // Independently recompute which questions share the most common option set.
  const groups = new Map<string, number>();
  for (const q of rawQuestions) {
    if (!q.options) continue;
    const key = JSON.stringify(q.options);
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  let bestKey = "";
  let bestCount = 0;
  for (const [key, count] of groups) {
    if (count > bestCount) {
      bestKey = key;
      bestCount = count;
    }
  }
  const expectedScale: string[] = bestKey ? JSON.parse(bestKey) : [];

  eq("Scale option count", scaleOptions.length, expectedScale.length);
  check(
    "Scale options exact & in order",
    scaleOptions.every((o, i) => o === expectedScale[i]),
    "the 5-point option strings differ from the source",
  );
  eq("Scale question count", scaleQuestions.length, bestCount, `${bestCount} rating questions`);
}

/* ================================================================== *
 * LAYER 2 — source file vs database seed migrations
 * ================================================================== */

const schoolsSqlPath = join(root, "supabase", "migrations", "20260101000300_seed_schools.sql");
const surveySqlPath = join(root, "supabase", "migrations", "20260101000400_seed_survey_baseline.sql");

if (!existsSync(schoolsSqlPath) || !existsSync(surveySqlPath)) {
  check(
    "Seed migrations exist",
    false,
    "run `npm run generate:migrations` to generate 0003 and 0004",
  );
} else {
  const schoolsSql = readFileSync(schoolsSqlPath, "utf8");
  const surveySql = readFileSync(surveySqlPath, "utf8");

  /**
   * SQL-escaped form of a literal, mirroring the generator exactly.
   *
   * The generator emits E'' escape strings in which a newline is written as
   * the two characters backslash-n, never as a literal line break. A literal
   * break would be rewritten to CRLF by a Windows checkout, and that carriage
   * return would then be stored in the database.
   */
  const sqlLit = (value: string) =>
    value
      .replace(/\\/gu, "\\\\")
      .replace(/'/gu, "''")
      .replace(/\r\n/gu, "\\n")
      .replace(/\n/gu, "\\n")
      .replace(/\r/gu, "\\n");

  const missingSchools = rawSchools.filter((name) => !schoolsSql.includes(`(E'${sqlLit(name)}',`));
  check(
    "Every school is present in 20260101000300_seed_schools.sql",
    missingSchools.length === 0,
    missingSchools.length === 0
      ? undefined
      : `${missingSchools.length} missing, first: "${missingSchools[0]}"`,
    `${rawSchools.length} checked`,
  );

  const missingSections = rawSections.filter((s) => !surveySql.includes(`E'${sqlLit(s.title)}'`));
  check(
    "Every section title is present in the survey seed",
    missingSections.length === 0,
    missingSections.length === 0
      ? undefined
      : `missing: ${missingSections.map((s) => s.title).join("; ")}`,
  );

  const missingQuestions = rawQuestions.filter((q) => !surveySql.includes(`E'${sqlLit(q.title)}'`));
  check(
    "Every question wording is present in the survey seed",
    missingQuestions.length === 0,
    missingQuestions.length === 0
      ? undefined
      : `missing: ${missingQuestions.map((q) => q.title).join("; ")}`,
  );

  const missingEntryIds = rawQuestions.filter((q) => !surveySql.includes(String(q.entry_id)));
  check(
    "Every original entry id is present in the survey seed",
    missingEntryIds.length === 0,
    missingEntryIds.length === 0
      ? undefined
      : `missing ids: ${missingEntryIds.map((q) => q.entry_id).join(", ")}`,
  );

  // Options are embedded as a JSON array inside a SQL literal.
  const missingOptionSets = rawQuestions.filter((q) => {
    if (!q.options) return false;
    return !surveySql.includes(sqlLit(JSON.stringify(q.options)));
  });
  check(
    "Every answer option set is present in the survey seed",
    missingOptionSets.length === 0,
    missingOptionSets.length === 0
      ? undefined
      : `missing for: ${missingOptionSets.map((q) => q.title).join("; ")}`,
  );

  // The seed's own guard counts must match the source.
  check(
    "Survey seed asserts the correct section count",
    surveySql.includes(`Expected ${rawSections.length} sections`),
    "the seed's self-check does not match the source section count",
  );
  check(
    "Survey seed asserts the correct question count",
    surveySql.includes(`Expected ${rawQuestions.length} questions`),
    "the seed's self-check does not match the source question count",
  );
  check(
    "School seed asserts the correct school count",
    schoolsSql.includes(`Expected ${rawSchools.length} schools`),
    "the seed's self-check does not match the source school count",
  );
}

/* ================================================================== *
 * LAYER 3 — content fingerprint
 * ================================================================== */

/** Canonical projection of everything that must never change silently. */
const canonical = JSON.stringify({
  formTitle: raw.form_title,
  header: raw.header_description,
  confirmation: raw.confirmation_message,
  collectsEmail: raw.collects_email,
  sections: rawSections.map((s) => ({ title: s.title, description: s.description })),
  questions: rawQuestions.map((q) => ({
    index: q.index,
    entryId: q.entry_id,
    title: q.title,
    description: q.description,
    type: q.type,
    required: q.required,
    options: q.options ?? null,
  })),
  schools: rawSchools,
});

const fingerprint = createHash("sha256").update(canonical).digest("hex");
const fingerprintPath = join(root, "data", "content-fingerprint.json");
const shouldUpdate = process.argv.includes("--update");

if (shouldUpdate) {
  writeFileSync(
    fingerprintPath,
    `${JSON.stringify(
      {
        fingerprint,
        algorithm: "sha256",
        updatedAt: new Date().toISOString().slice(0, 10),
        sections: rawSections.length,
        questions: rawQuestions.length,
        required: rawQuestions.filter((q) => q.required).length,
        schools: rawSchools.length,
        note: "Baseline fingerprint of the verified survey content. Regenerate ONLY with `npm run verify:survey -- --update` after an intentional, re-verified content change.",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  check("Content fingerprint baseline written", true, undefined, fingerprint.slice(0, 16));
} else if (!existsSync(fingerprintPath)) {
  check(
    "Content fingerprint baseline exists",
    false,
    "no baseline found — create it with `npm run verify:survey -- --update`",
  );
} else {
  const baseline = JSON.parse(readFileSync(fingerprintPath, "utf8")) as {
    fingerprint: string;
  };
  const ok = baseline.fingerprint === fingerprint;
  check(
    "Content fingerprint matches the committed baseline",
    ok,
    ok
      ? undefined
      : `content has changed.\n      baseline: ${baseline.fingerprint}\n      current:  ${fingerprint}\n      If this change is intentional, re-verify against the original Google Form,\n      then re-baseline with: npm run verify:survey -- --update`,
    fingerprint.slice(0, 16),
  );
}

/* ================================================================== *
 * Report
 * ================================================================== */

// Colour only when attached to a TTY, so piped or CI output stays clean.
const ESC = String.fromCharCode(27);
const colour = (code: string) => (process.stdout.isTTY ? `${ESC}[${code}m` : "");
const GREEN = colour("32");
const RED = colour("31");
const DIM = colour("2");
const BOLD = colour("1");
const RESET = colour("0");

const lines: string[] = [];
lines.push("");
lines.push(`${BOLD}PLP survey content verification${RESET}`);
lines.push(`${DIM}source: data/survey-source.json${RESET}`);
lines.push(`${DIM}form:   ${raw.form_title}${RESET}`);
lines.push("");

for (const c of checks) {
  const mark = c.ok ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
  const info = c.info ? ` ${DIM}(${c.info})${RESET}` : "";
  lines.push(`  [${mark}] ${c.name}${info}`);
  if (!c.ok && c.detail) lines.push(`         ${RED}${c.detail}${RESET}`);
}

lines.push("");
lines.push(`${BOLD}Deployment overlay${RESET}`);
if (!hasDeploymentOverrides) {
  lines.push(`  ${DIM}None — this deployment matches the original form exactly.${RESET}`);
} else {
  lines.push(`  ${BOLD}${deployment.name}${RESET}`);
  lines.push(`  ${DIM}The source file is UNCHANGED and verified above. These deviations${RESET}`);
  lines.push(`  ${DIM}are deliberate and apply to this deployment only:${RESET}`);
  lines.push("");

  const schoolOverride = deployment.overrides.schools;
  const yearOverride = deployment.overrides.yearLevels;

  if (schoolOverride) {
    lines.push(
      `  · School list   ${sourceSchoolList.length} source options -> ${schoolOverride.options.length}`,
    );
    lines.push(`      ${DIM}${schoolOverride.options.join(", ")}${RESET}`);
    lines.push(`      ${DIM}${schoolOverride.reason}${RESET}`);
  }
  if (yearOverride) {
    const firstSection = raw.items.find((i) => i.type === "section_header")?.index ?? 0;
    const sourceYears =
      rawQuestions.find((q) => q.type === "multiple_choice" && q.index < firstSection)?.options ??
      [];
    lines.push(`  · Year levels   ${sourceYears.join(", ")}`);
    lines.push(`                  -> ${yearOverride.options.join(", ")}`);
    lines.push(`      ${DIM}${yearOverride.reason}${RESET}`);
  }

  lines.push("");
  lines.push(`  ${DIM}Clear "overrides" in data/deployment.json to return to the official form.${RESET}`);
}

lines.push("");
lines.push(`${BOLD}Content inventory${RESET}`);
lines.push(`  Sections ................ ${surveyStats.sectionCount}`);
lines.push(`  Questions ............... ${surveyStats.questionCount}`);
lines.push(
  `  Required / optional ..... ${surveyStats.requiredCount} / ${surveyStats.optionalCount}`,
);
lines.push(`  Rating questions ........ ${surveyStats.scaleQuestionCount}`);
lines.push(`  Scale points ............ ${scaleOptions.length}`);
lines.push(
  `  Schools ................. ${sourceSchoolList.length} in source` +
    (hasDeploymentOverrides && schools.length !== sourceSchoolList.length
      ? `, ${schools.length} active here`
      : ""),
);
lines.push(
  `  Email collection ........ ${surveySource.collects_email.enabled ? "enabled" : "disabled"}${
    surveySource.collects_email.required ? ", required" : ""
  }`,
);
lines.push(`  Guided steps ............ ${surveySteps.length}`);
lines.push(`  Fingerprint ............. ${fingerprint.slice(0, 32)}…`);
lines.push("");

const passed = checks.length - failures;
if (failures === 0) {
  lines.push(`${GREEN}${BOLD}All ${checks.length} checks passed.${RESET}`);
  lines.push(
    `${DIM}The application's survey content matches data/survey-source.json exactly.${RESET}`,
  );
} else {
  lines.push(`${RED}${BOLD}${failures} of ${checks.length} checks FAILED${RESET} (${passed} passed)`);
  lines.push(`${RED}The application no longer matches the verified survey source.${RESET}`);
}
lines.push("");

console.log(lines.join("\n"));

process.exit(failures === 0 ? 0 : 1);
