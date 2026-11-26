/**
 * Live database verification.
 *
 *   npm run verify:db
 *
 * Connects to the configured Supabase project and checks three things:
 *
 *   1. CONTENT — the seeded survey matches `data/survey-source.json` exactly:
 *      section titles and descriptions, question wording, help text, original
 *      entry ids, types, required flags, every answer option, and all 180
 *      school names, in the original order.
 *
 *   2. RLS — the anon key can read public survey content but is REFUSED any
 *      access to responses, answers and the admin allow-list. This is the real
 *      runtime check that the static policy tests cannot make.
 *
 *   3. ADMIN — whether an administrator profile exists yet.
 *
 * Credentials are read from .env.local and are never printed.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

/* ------------------------------------------------------------------ *
 * Environment
 * ------------------------------------------------------------------ */

function loadEnvLocal(): Record<string, string> {
  const path = join(root, ".env.local");
  if (!existsSync(path)) {
    console.error("No .env.local found. Copy .env.example and fill in your credentials.");
    process.exit(1);
  }

  const env: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

const env = loadEnvLocal();
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY ?? "";

for (const [name, value] of [
  ["NEXT_PUBLIC_SUPABASE_URL", URL_],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", ANON],
  ["SUPABASE_SERVICE_ROLE_KEY", SERVICE],
] as const) {
  if (!value) {
    console.error(`${name} is missing from .env.local`);
    process.exit(1);
  }
}

const anon: SupabaseClient = createClient(URL_, ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const admin: SupabaseClient = createClient(URL_, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/* ------------------------------------------------------------------ *
 * Source of truth
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

const sourceFull = JSON.parse(
  readFileSync(join(root, "data", "survey-source.json"), "utf8"),
) as {
  form_title: string;
  header_description: string;
  confirmation_message: string;
  items: RawItem[];
};
const source = sourceFull;

/**
 * Explains how two strings differ, naming invisible causes first.
 * A CRLF/LF mismatch is the one that actually bit us.
 */
function describeTextDiff(expected: string, actual: string | null): string | undefined {
  if (actual === null) return "value is null";
  if (expected === actual) return undefined;

  if (actual.includes("\r")) {
    return (
      "contains carriage returns (CRLF) where the source has plain LF — " +
      `${actual.length} chars stored vs ${expected.length} in source. ` +
      "Run migration 0007 to normalise."
    );
  }
  if (expected.replace(/\r\n/gu, "\n") === actual.replace(/\r\n/gu, "\n")) {
    return "differs only in line endings";
  }
  if (expected.trim() === actual.trim()) return "differs in leading/trailing whitespace";

  const at = [...expected].findIndex((ch, i) => ch !== actual[i]);
  return `first difference at character ${at + 1}: expected ${JSON.stringify(
    expected.slice(at, at + 24),
  )}, found ${JSON.stringify(actual.slice(at, at + 24))}`;
}

const srcSections = source.items.filter((i) => i.type === "section_header");
const srcQuestions = source.items.filter((i) => i.type !== "section_header");
const srcSchools = source.items.find((i) => i.type === "dropdown")?.options ?? [];

const SLUG = "plp-survey-1-baseline-term-1";

/* ------------------------------------------------------------------ *
 * Reporting
 * ------------------------------------------------------------------ */

const ESC = String.fromCharCode(27);
const c = (code: string) => (process.stdout.isTTY ? `${ESC}[${code}m` : "");
const GREEN = c("32");
const RED = c("31");
const DIM = c("2");
const BOLD = c("1");
const RESET = c("0");

let failures = 0;
const lines: string[] = [];

function check(ok: boolean, name: string, detail?: string) {
  if (!ok) failures += 1;
  lines.push(`  [${ok ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`}] ${name}`);
  if (!ok && detail) lines.push(`         ${RED}${detail}${RESET}`);
}

function section(title: string) {
  lines.push("");
  lines.push(`${BOLD}${title}${RESET}`);
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */

async function main() {
  lines.push("");
  lines.push(`${BOLD}PLP live database verification${RESET}`);
  lines.push(`${DIM}project: ${URL_}${RESET}`);

  /* ---------------- 1. Survey ---------------- */
  section("Survey");

  const { data: survey, error: surveyError } = await admin
    .from("surveys")
    .select(
      "id, slug, title, description, confirmation_message, status, is_locked, collects_email, email_required",
    )
    .eq("slug", SLUG)
    .maybeSingle();

  if (surveyError || !survey) {
    check(false, "Baseline survey exists", surveyError?.message ?? "not found");
    report();
    return;
  }

  check(true, "Baseline survey exists");
  check(survey.title === source.form_title, "Title matches source", `found "${survey.title}"`);

  // Compared byte for byte: a stray carriage return from a Windows checkout is
  // invisible on screen but means the stored text is not the original text.
  check(
    survey.description === sourceFull.header_description,
    "Intro text matches source byte for byte",
    describeTextDiff(sourceFull.header_description, survey.description),
  );
  check(
    survey.confirmation_message === sourceFull.confirmation_message,
    "Confirmation message matches source byte for byte",
    describeTextDiff(sourceFull.confirmation_message, survey.confirmation_message),
  );
  check(survey.status === "active", "Status is active", `found "${survey.status}"`);
  check(survey.is_locked === true, "Content is locked");
  check(survey.collects_email === true, "Email collection enabled");
  check(survey.email_required === true, "Email is required");

  /* ---------------- 2. Sections ---------------- */
  section("Sections");

  const { data: sections } = await admin
    .from("survey_sections")
    .select("order_index, title, description")
    .eq("survey_id", survey.id)
    .order("order_index");

  const secs = sections ?? [];
  check(secs.length === srcSections.length, `${srcSections.length} sections seeded`, `found ${secs.length}`);

  let sectionMismatch: string | null = null;
  srcSections.forEach((src, i) => {
    const row = secs[i];
    if (!row) return;
    if (row.title !== src.title) sectionMismatch ??= `section ${i + 1} title: "${row.title}"`;
    if (row.description !== src.description) {
      sectionMismatch ??= `section ${i + 1} description differs`;
    }
  });
  check(sectionMismatch === null, "Section titles and descriptions match source exactly", sectionMismatch ?? undefined);

  /* ---------------- 3. Questions ---------------- */
  section("Questions");

  const { data: questions } = await admin
    .from("questions")
    .select("entry_id, order_index, title, description, type, options, is_required")
    .eq("survey_id", survey.id)
    .order("order_index");

  const qs = questions ?? [];
  check(qs.length === srcQuestions.length, `${srcQuestions.length} questions seeded`, `found ${qs.length}`);
  check(
    qs.filter((q) => q.is_required).length === srcQuestions.filter((q) => q.required).length,
    "27 required / 1 optional",
    `found ${qs.filter((q) => q.is_required).length} required`,
  );

  let qMismatch: string | null = null;
  srcQuestions.forEach((src, i) => {
    const row = qs[i];
    if (!row) {
      qMismatch ??= `question ${i + 1} missing`;
      return;
    }
    if (row.title !== src.title) qMismatch ??= `Q${i + 1} wording: "${row.title}"`;
    if (Number(row.entry_id) !== src.entry_id) qMismatch ??= `Q${i + 1} entry id`;
    if (row.description !== src.description) qMismatch ??= `Q${i + 1} help text`;
    if (row.is_required !== src.required) qMismatch ??= `Q${i + 1} required flag`;
    if (row.order_index !== src.index) qMismatch ??= `Q${i + 1} order`;

    const srcOpts = src.options ?? null;
    const dbOpts = (row.options as string[] | null) ?? null;
    if (JSON.stringify(srcOpts) !== JSON.stringify(dbOpts)) {
      qMismatch ??= `Q${i + 1} options differ`;
    }
  });
  check(qMismatch === null, "Wording, entry ids, order, flags and options match source exactly", qMismatch ?? undefined);

  const scaleQs = qs.filter((q) => Array.isArray(q.options) && (q.options as string[]).length === 5);
  check(scaleQs.length === 21, "21 rating questions", `found ${scaleQs.length}`);

  const firstOption = (scaleQs[0]?.options as string[] | undefined)?.[0];
  check(
    firstOption === "1 — Strongly Disagree / Not at all",
    "Scale options stored as exact strings (em dash intact)",
    `found "${firstOption}"`,
  );

  /* ---------------- 4. Schools ---------------- */
  section("Schools");

  const { data: schools } = await admin
    .from("schools")
    .select("name, display_order")
    .order("display_order");

  const sch = schools ?? [];
  check(sch.length === srcSchools.length, `${srcSchools.length} schools seeded`, `found ${sch.length}`);

  const schoolMismatch = srcSchools.findIndex((name, i) => sch[i]?.name !== name);
  check(
    schoolMismatch === -1,
    "All school names match source exactly, in original order",
    schoolMismatch === -1
      ? undefined
      : `#${schoolMismatch + 1}: expected "${srcSchools[schoolMismatch]}", found "${sch[schoolMismatch]?.name}"`,
  );

  const accented = sch.find((s) => s.name.includes("Immacul"));
  check(
    accented?.name === "Collège de l'Immaculée Conception",
    "Accents survived the round trip",
    `found "${accented?.name}"`,
  );

  /* ---------------- 5. RLS (the real runtime test) ---------------- */
  section("Row Level Security — anonymous key");

  const { data: anonSchools, error: anonSchoolsErr } = await anon
    .from("schools")
    .select("name")
    .limit(1);
  check(
    !anonSchoolsErr && (anonSchools?.length ?? 0) > 0,
    "anon CAN read the school list (needed to render the form)",
    anonSchoolsErr?.message,
  );

  const { data: anonQs, error: anonQsErr } = await anon
    .from("questions")
    .select("title")
    .limit(1);
  check(
    !anonQsErr && (anonQs?.length ?? 0) > 0,
    "anon CAN read active survey questions",
    anonQsErr?.message,
  );

  const { data: anonResp, error: anonRespErr } = await anon
    .from("survey_responses")
    .select("email");
  check(
    Boolean(anonRespErr) || (anonResp?.length ?? 0) === 0,
    "anon CANNOT read survey_responses",
    anonRespErr ? undefined : `returned ${anonResp?.length} rows`,
  );

  const { data: anonAns, error: anonAnsErr } = await anon.from("answers").select("answer_text");
  check(
    Boolean(anonAnsErr) || (anonAns?.length ?? 0) === 0,
    "anon CANNOT read answers",
    anonAnsErr ? undefined : `returned ${anonAns?.length} rows`,
  );

  const { data: anonAdmins, error: anonAdminsErr } = await anon
    .from("admin_profiles")
    .select("email");
  check(
    Boolean(anonAdminsErr) || (anonAdmins?.length ?? 0) === 0,
    "anon CANNOT read the admin allow-list",
    anonAdminsErr ? undefined : `returned ${anonAdmins?.length} rows`,
  );

  const { error: anonInsertErr } = await anon
    .from("survey_responses")
    .insert({
      survey_id: survey.id,
      email: "rls-probe@example.invalid",
      full_name: "RLS Probe",
      school_name: srcSchools[0],
      year_level: "S1",
    });
  check(
    Boolean(anonInsertErr),
    "anon CANNOT insert a response directly",
    anonInsertErr ? undefined : "insert unexpectedly succeeded — clean it up immediately",
  );

  /* ---------------- 6. Admin ---------------- */
  section("Administrators");

  const { count: adminCount } = await admin
    .from("admin_profiles")
    .select("id", { count: "exact", head: true });

  const { count: responseCount } = await admin
    .from("survey_responses")
    .select("id", { count: "exact", head: true });

  if ((adminCount ?? 0) > 0) {
    check(true, `${adminCount} administrator profile(s) configured`);
  } else {
    lines.push(
      `  [${DIM}TODO${RESET}] No administrator yet — create the Auth user, then run:`,
    );
    lines.push(`         ${DIM}select public.grant_admin('you@example.org', 'owner');${RESET}`);
  }

  lines.push(`  ${DIM}Responses so far: ${responseCount ?? 0}${RESET}`);

  report();
}

function report() {
  lines.push("");
  if (failures === 0) {
    lines.push(`${GREEN}${BOLD}All checks passed.${RESET}`);
    lines.push(
      `${DIM}The live database matches data/survey-source.json, and RLS is enforcing access.${RESET}`,
    );
  } else {
    lines.push(`${RED}${BOLD}${failures} check(s) FAILED.${RESET}`);
  }
  lines.push("");
  console.log(lines.join("\n"));
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("\nVerification could not run:", error instanceof Error ? error.message : error);
  process.exit(1);
});
