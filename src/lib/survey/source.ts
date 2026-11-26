/**
 * Single source of truth for all survey content.
 *
 * Every question, section, description, answer option, school name, required flag
 * and original Google entry id is read from `data/survey-source.json` — the file
 * produced by extracting (and verifying) the original Google Form.
 *
 * Nothing in this file hard-codes survey wording. If the JSON changes, the app changes.
 */
import { z } from "zod";
import rawSource from "@data/survey-source.json";
import rawDeployment from "@data/deployment.json";

/* ------------------------------------------------------------------ *
 * Schema — validates the source file at load time.
 * A malformed or truncated source file must fail loudly, not silently
 * render a partial survey.
 * ------------------------------------------------------------------ */

export const QUESTION_TYPES = [
  "short_answer",
  "paragraph",
  "multiple_choice",
  "dropdown",
  "section_header",
] as const;

const itemSchema = z.object({
  index: z.number().int().nonnegative(),
  type: z.enum(QUESTION_TYPES),
  title: z.string(),
  description: z.string().nullable(),
  entry_id: z.number().int().optional(),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
});

const sourceSchema = z.object({
  source_url: z.string().url(),
  extracted_at: z.string(),
  form_title: z.string(),
  owner: z.string(),
  header_description: z.string(),
  confirmation_message: z.string(),
  collects_email: z.object({
    enabled: z.boolean(),
    required: z.boolean(),
    mode: z.string(),
    rendered_label: z.string(),
    rendered_checkbox_label: z.string(),
    note: z.string().optional(),
  }),
  items: z.array(itemSchema).min(1),
});

export type SurveySource = z.infer<typeof sourceSchema>;
export type SurveyItem = z.infer<typeof itemSchema>;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** A real question (never a section header). */
export type Question = SurveyItem & {
  type: Exclude<QuestionType, "section_header">;
  entry_id: number;
  required: boolean;
  /** Stable form/DB field key derived from the original Google entry id. */
  fieldKey: string;
};

export type SurveySection = {
  /** 1-based display order of the section. */
  order: number;
  /** Payload index of the section-header item. */
  index: number;
  /** Exact section title from the original form. */
  title: string;
  /** Exact section description from the original form (null when absent). */
  description: string | null;
  /** Short label for the progress indicator, e.g. "A1". */
  shortLabel: string;
  /** Human sub-title with the code stripped, e.g. "Leadership Identity & Confidence". */
  plainTitle: string;
  questions: Question[];
};

/* ------------------------------------------------------------------ *
 * Load + validate (module-level, so it happens exactly once)
 * ------------------------------------------------------------------ */

function loadSource(): SurveySource {
  const parsed = sourceSchema.safeParse(rawSource);
  if (!parsed.success) {
    throw new Error(
      `data/survey-source.json failed validation — refusing to render a partial survey.\n${parsed.error.toString()}`,
    );
  }
  return parsed.data;
}

export const surveySource: SurveySource = loadSource();


/* ------------------------------------------------------------------ *
 * Deployment overlay
 * ------------------------------------------------------------------ *
 * `survey-source.json` is the untouched, verified extract of the original
 * Google Form and must never be edited to suit one deployment. Where a
 * particular rollout genuinely needs different answer options — a single-school
 * recruitment drive, a school that grades its years differently — those
 * deviations are declared in `deployment.json` and applied here.
 *
 * Question wording, ordering, required flags, section text and the entry ids
 * are NEVER overridden. Only answer option lists can be, and only for the two
 * questions named below.
 */

const overrideSchema = z.object({
  reason: z.string(),
  replacesSourceOptions: z.boolean().optional(),
  options: z.array(z.string()).min(1),
});

/**
 * Wrapper language only. This can never change a question, an option, the form
 * title or the confirmation message — those are source content.
 */
const framingSchema = z.object({
  mode: z.enum(["survey", "application"]),
  reason: z.string(),
  audience: z.string().optional(),
  labels: z
    .object({
      noun: z.string().optional(),
      nounPlural: z.string().optional(),
      cta: z.string().optional(),
      ctaShort: z.string().optional(),
      headline: z.string().optional(),
      lede: z.string().optional(),
      eyebrow: z.string().optional(),
      submit: z.string().optional(),
      successTitle: z.string().optional(),
      successBody: z.string().optional(),
      reviewTitle: z.string().optional(),
    })
    .default({}),
});

const deploymentSchema = z.object({
  name: z.string(),
  rationale: z.string().optional(),
  appliedOn: z.string().optional(),
  note: z.string().optional(),
  overrides: z
    .object({
      schools: overrideSchema.optional(),
      yearLevels: overrideSchema.optional(),
    })
    .default({}),
  framing: framingSchema.optional(),
});

export type Deployment = z.infer<typeof deploymentSchema>;

export const deployment: Deployment = (() => {
  const parsed = deploymentSchema.safeParse(rawDeployment);
  if (!parsed.success) {
    throw new Error(`data/deployment.json failed validation.
${parsed.error.toString()}`);
  }
  return parsed.data;
})();

/** True when this deployment deviates from the original form in any way. */
export const hasDeploymentOverrides =
  Boolean(deployment.overrides.schools) || Boolean(deployment.overrides.yearLevels);

/* ------------------------------------------------------------------ *
 * Derived views
 * ------------------------------------------------------------------ */

/** Field key for a question — stable, derived from the original Google entry id. */
export function fieldKeyFor(entryId: number): string {
  return `q_${entryId}`;
}

function toQuestion(item: SurveyItem): Question {
  if (item.type === "section_header") {
    throw new Error(`Item ${item.index} is a section header, not a question.`);
  }
  if (item.entry_id === undefined || item.required === undefined) {
    throw new Error(`Question at index ${item.index} is missing entry_id/required.`);
  }
  return {
    ...item,
    type: item.type,
    entry_id: item.entry_id,
    required: item.required,
    fieldKey: fieldKeyFor(item.entry_id),
  };
}

/** Questions exactly as the original form defines them, before any overlay. */
export const sourceQuestions: Question[] = surveySource.items
  .filter((i) => i.type !== "section_header")
  .map(toQuestion);

/**
 * Apply the deployment overlay's option overrides.
 *
 * The two overridable questions are identified STRUCTURALLY, from the block of
 * questions that precedes the first section header: that block is Full Name
 * (short answer), School Name (the form's only dropdown) and Year Level (its
 * only multiple-choice question). Nothing is matched on wording, so this keeps
 * working if the form is re-extracted.
 *
 * Only `options` is ever replaced. Wording, help text, entry ids, ordering and
 * required flags always come from the source.
 */
function applyDeploymentOverrides(questions: Question[]): Question[] {
  const firstSectionIndex = surveySource.items.find(
    (i) => i.type === "section_header",
  )?.index;

  const isPreSection = (q: Question) =>
    firstSectionIndex === undefined || q.index < firstSectionIndex;

  const schoolEntry = questions.find((q) => isPreSection(q) && q.type === "dropdown")?.entry_id;
  const yearEntry = questions.find(
    (q) => isPreSection(q) && q.type === "multiple_choice",
  )?.entry_id;

  const { schools: schoolOverride, yearLevels: yearOverride } = deployment.overrides;

  return questions.map((q) => {
    if (schoolOverride && q.entry_id === schoolEntry) {
      return { ...q, options: [...schoolOverride.options] };
    }
    if (yearOverride && q.entry_id === yearEntry) {
      return { ...q, options: [...yearOverride.options] };
    }
    return q;
  });
}

/**
 * Every question in original form order, with any deployment overrides applied.
 * This is what the app renders, validates against and seeds the database from.
 */
export const allQuestions: Question[] = applyDeploymentOverrides(sourceQuestions);

/**
 * Questions that appear BEFORE the first section header in the original form
 * (Full Name, School Name, Year Level). These belong to no section.
 */
export const participantQuestions: Question[] = (() => {
  const firstSectionIndex = surveySource.items.find((i) => i.type === "section_header")?.index;
  if (firstSectionIndex === undefined) return allQuestions;
  return allQuestions.filter((q) => q.index < firstSectionIndex);
})();

/** The 5 section blocks, each carrying the questions that follow it. */
export const surveySections: SurveySection[] = (() => {
  const sections: SurveySection[] = [];
  let current: SurveySection | null = null;

  for (const item of surveySource.items) {
    if (item.type === "section_header") {
      // "SECTION A1 — Leadership Identity & Confidence" -> "A1" + the rest
      const match = /^SECTION\s+([A-Z0-9]+)\s*—\s*(.*)$/u.exec(item.title);
      current = {
        order: sections.length + 1,
        index: item.index,
        title: item.title,
        description: item.description,
        shortLabel: match?.[1] ?? String(sections.length + 1),
        plainTitle: match?.[2] ?? item.title,
        questions: [],
      };
      sections.push(current);
      continue;
    }
    if (current) {
      const effective = allQuestions.find((q) => q.index === item.index);
      current.questions.push(effective ?? toQuestion(item));
    }
  }

  return sections;
})();

/** The School Name question — the one dropdown in the form. */
export const schoolQuestion: Question = (() => {
  const q = allQuestions.find((x) => x.type === "dropdown");
  if (!q || !q.options?.length) {
    throw new Error("Expected a dropdown question carrying the school list.");
  }
  return q;
})();

/** The school names this deployment actually offers (after any overlay). */
export const schools: string[] = schoolQuestion.options ?? [];

/**
 * The full original school list from the Google Form, regardless of overlay.
 * Used by content verification and by the admin dashboard when it needs to
 * report against the official list rather than the active one.
 */
export const sourceSchools: string[] =
  sourceQuestions.find((q) => q.type === "dropdown")?.options ?? [];

/** Year levels this deployment offers (after any overlay). */
export const sourceYearLevels: string[] = (() => {
  const firstSectionIndex = surveySource.items.find(
    (i) => i.type === "section_header",
  )?.index;
  return (
    sourceQuestions.find(
      (q) =>
        q.type === "multiple_choice" &&
        (firstSectionIndex === undefined || q.index < firstSectionIndex),
    )?.options ?? []
  );
})();

/**
 * The repeated 5-point option set, taken from the first question that uses it.
 * These are literal strings ("1 — Strongly Disagree / Not at all"), never numbers.
 */
export const scaleOptions: string[] = (() => {
  const counts = new Map<string, { options: string[]; n: number }>();
  for (const q of allQuestions) {
    if (q.type !== "multiple_choice" || !q.options) continue;
    const key = q.options.join(" ");
    const entry = counts.get(key);
    if (entry) entry.n += 1;
    else counts.set(key, { options: q.options, n: 1 });
  }
  let best: { options: string[]; n: number } | null = null;
  for (const entry of counts.values()) {
    if (!best || entry.n > best.n) best = entry;
  }
  return best?.options ?? [];
})();

/** Questions that use the repeated 5-point scale (21 of them). */
export const scaleQuestions: Question[] = allQuestions.filter(
  (q) =>
    q.type === "multiple_choice" &&
    q.options !== undefined &&
    q.options.length === scaleOptions.length &&
    q.options.every((opt, i) => opt === scaleOptions[i]),
);

/**
 * The participant's name question — the form's only short-answer question.
 * Identified structurally, not by matching on its wording.
 */
export const nameQuestion: Question = (() => {
  const q = allQuestions.find((x) => x.type === "short_answer");
  if (!q) throw new Error("Expected a short-answer question for the participant's name.");
  return q;
})();

/**
 * The year-level question — the one multiple-choice question whose options are
 * NOT the repeated 5-point scale.
 */
export const yearLevelQuestion: Question = (() => {
  const q = allQuestions.find(
    (x) =>
      x.type === "multiple_choice" &&
      x.options !== undefined &&
      !(
        x.options.length === scaleOptions.length &&
        x.options.every((opt, i) => opt === scaleOptions[i])
      ),
  );
  if (!q) throw new Error("Expected a non-scale multiple-choice question for the year level.");
  return q;
})();

/** True when a question uses the repeated 5-point scale. */
export function isScaleQuestion(q: Question): boolean {
  return scaleQuestions.some((s) => s.entry_id === q.entry_id);
}

/** Look up a question by its original Google entry id. */
export function questionByEntryId(entryId: number): Question | undefined {
  return allQuestions.find((q) => q.entry_id === entryId);
}

/** The section a question belongs to, or null for participant-detail questions. */
export function sectionForQuestion(entryId: number): SurveySection | null {
  return surveySections.find((s) => s.questions.some((q) => q.entry_id === entryId)) ?? null;
}

/* ------------------------------------------------------------------ *
 * Counts — used by the verification script and the admin dashboard
 * ------------------------------------------------------------------ */

export const surveyStats = {
  totalItems: surveySource.items.length,
  sectionCount: surveySections.length,
  questionCount: allQuestions.length,
  requiredCount: allQuestions.filter((q) => q.required).length,
  optionalCount: allQuestions.filter((q) => !q.required).length,
  schoolCount: schools.length,
  scaleQuestionCount: scaleQuestions.length,
  collectsEmail: surveySource.collects_email.enabled,
} as const;

/** Stable slug for the baseline survey record in the database. */
export const BASELINE_SURVEY_SLUG = "plp-survey-1-baseline-term-1";

/**
 * The original header description split into its paragraphs, verbatim.
 * The form's intro is one field containing three blank-line-separated blocks:
 * the curriculum line, the explanation, and the privacy note. Splitting lets the
 * UI lay them out separately without altering a single character.
 */
export const headerParagraphs: string[] = surveySource.header_description
  .split(/\n{2,}/u)
  .map((p) => p.trim())
  .filter((p) => p.length > 0);

/** Section descriptions repeat the scale legend; this detects that case. */
export function isScaleLegend(text: string | null): boolean {
  if (!text) return false;
  return scaleOptions.length > 0 && /^1\s*=/u.test(text.trim());
}

/**
 * Estimated completion time in minutes, derived from the question mix.
 * Presented in the UI explicitly as an estimate, never as a limit.
 */
export const estimatedMinutes: number = (() => {
  const seconds = allQuestions.reduce((total, q) => {
    if (q.type === "paragraph") return total + 55;
    if (q.type === "dropdown") return total + 25;
    if (q.type === "multiple_choice") return total + 12;
    return total + 18;
  }, 60); // + email / settling in
  return Math.max(5, Math.round(seconds / 60));
})();
