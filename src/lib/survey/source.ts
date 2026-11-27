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

/**
 * Which of the source questions this deployment actually asks.
 *
 * A rollout may legitimately ask only part of the instrument — a club
 * application needs the applicant's identity, not a mid-programme baseline.
 * The questions left out are WITHHELD, never deleted: they stay in
 * survey-source.json, still verified, and are restored by removing this list.
 */
const questionSetSchema = z.object({
  reason: z.string(),
  /**
   * May be empty: a rollout can ask none of the source questions and have the
   * admin write all of them. An empty list is still a DECLARATION, which is
   * what separates it from questions quietly going missing.
   */
  include: z.array(z.number().int()),
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
      questions: questionSetSchema.optional(),
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
  Boolean(deployment.overrides.schools) ||
  Boolean(deployment.overrides.yearLevels) ||
  Boolean(deployment.overrides.questions);

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
 * The entry ids this deployment asks, in original form order.
 *
 * With no `questions` override every source question is asked, which is the
 * original form. A declared `include` list narrows it — see the note on
 * `questionSetSchema`.
 */
export const askedEntryIds: ReadonlySet<number> = (() => {
  const declared = deployment.overrides.questions?.include;
  if (!declared) return new Set(sourceQuestions.map((q) => q.entry_id));

  // An include list naming an id that is not in the source is a typo, and
  // would silently shrink the form. Fail loudly instead.
  const known = new Set(sourceQuestions.map((q) => q.entry_id));
  const unknown = declared.filter((id) => !known.has(id));
  if (unknown.length > 0) {
    throw new Error(
      `data/deployment.json includes question id(s) that are not in the source: ${unknown.join(", ")}.`,
    );
  }
  return new Set(declared);
})();

/** True when applicants are actually asked this question in this deployment. */
export function isAsked(entryId: number): boolean {
  return askedEntryIds.has(entryId);
}

/**
 * The questions this deployment asks, in original form order, with any
 * deployment overrides applied. This is what the app renders, validates
 * against and seeds the database from.
 */
const overlaidQuestions: Question[] = applyDeploymentOverrides(sourceQuestions);

export const allQuestions: Question[] = overlaidQuestions.filter((q) =>
  askedEntryIds.has(q.entry_id),
);

/**
 * Source questions this deployment does NOT ask.
 *
 * They are withheld, not deleted — still present and still verified in
 * `data/survey-source.json`. Content verification reports them so the gap
 * between the official instrument and this rollout is always visible.
 */
export const withheldQuestions: Question[] = sourceQuestions.filter(
  (q) => !askedEntryIds.has(q.entry_id),
);

/**
 * The identity block of the ORIGINAL form: the questions that appear before the
 * first section header (Full Name, School Name, Year Level). They belong to no
 * section.
 *
 * Source-scoped on purpose, so the step layout knows where these questions go
 * whether or not this deployment asks them. Use `askedParticipantQuestions` for
 * the ones an applicant is actually shown.
 */
export const participantQuestions: Question[] = (() => {
  const firstSectionIndex = surveySource.items.find((i) => i.type === "section_header")?.index;
  if (firstSectionIndex === undefined) return overlaidQuestions;
  return overlaidQuestions.filter((q) => q.index < firstSectionIndex);
})();

/** The identity questions this deployment actually asks. */
export const askedParticipantQuestions: Question[] = participantQuestions.filter((q) =>
  askedEntryIds.has(q.entry_id),
);

/**
 * Build the section blocks from a given set of questions.
 *
 * A section whose every question is absent from `questions` would otherwise
 * render as a heading with nothing under it, so empty sections are dropped and
 * the rest renumbered — the progress rail stays 1..n with no gaps.
 */
function buildSections(questions: Question[]): SurveySection[] {
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
      const question = questions.find((q) => q.index === item.index);
      if (question) current.questions.push(question);
    }
  }

  return sections
    .filter((section) => section.questions.length > 0)
    .map((section, i) => ({ ...section, order: i + 1 }));
}

/**
 * The section blocks of the ORIGINAL form — all 5, with every question.
 * This is the instrument's own structure, unaffected by what a deployment
 * chooses to ask. Content verification checks against this.
 */
export const sourceSections: SurveySection[] = buildSections(sourceQuestions);

/** The section blocks this deployment actually shows. */
export const surveySections: SurveySection[] = buildSections(allQuestions);

/**
 * Resolve a question structurally against the PRISTINE source, then return the
 * effective (overlaid) version of it.
 *
 * Anchors must be found whether or not this deployment asks the question, so
 * that migrations, the admin dashboard and verification can all still refer to
 * it. Use `isAsked()` to tell whether applicants actually see it.
 */
function anchor(find: (q: Question) => boolean, what: string): Question {
  const sourceMatch = sourceQuestions.find(find);
  if (!sourceMatch) throw new Error(`Expected ${what} in data/survey-source.json.`);
  // Resolve against the OVERLAID list, not the pristine one: a deployment that
  // withholds the school question still has exactly one school, and the rest of
  // the app needs to know which. Falling back to the raw source here would
  // silently hand back all 180.
  return (
    overlaidQuestions.find((q) => q.entry_id === sourceMatch.entry_id) ?? sourceMatch
  );
}

/** The School Name question — the one dropdown in the form. */
export const schoolQuestion: Question = (() => {
  const q = anchor((x) => x.type === "dropdown", "a dropdown carrying the school list");
  if (!q.options?.length) {
    throw new Error("Expected the school dropdown to carry options.");
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
  // Derived from the pristine source, never from the deployed subset: the
  // scale is a property of the instrument. A rollout that withholds every
  // scale question must not change what "the scale" means, or the year-level
  // question below would start looking like a scale question.
  for (const q of sourceQuestions) {
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

/** True when a question's options are exactly the repeated 5-point scale. */
function usesScale(q: Question): boolean {
  return (
    q.type === "multiple_choice" &&
    q.options !== undefined &&
    q.options.length === scaleOptions.length &&
    q.options.every((opt, i) => opt === scaleOptions[i])
  );
}

/** The 21 rating questions of the original instrument. */
export const sourceScaleQuestions: Question[] = sourceQuestions.filter(usesScale);

/** Questions this deployment asks that use the repeated 5-point scale. */
export const scaleQuestions: Question[] = allQuestions.filter(usesScale);

/**
 * The participant's name question — the form's only short-answer question.
 * Identified structurally, not by matching on its wording.
 */
export const nameQuestion: Question = anchor(
  (x) => x.type === "short_answer",
  "a short-answer question for the participant's name",
);

/**
 * The year-level question — the one multiple-choice question whose options are
 * NOT the repeated 5-point scale.
 */
export const yearLevelQuestion: Question = anchor(
  (x) =>
    x.type === "multiple_choice" &&
    x.options !== undefined &&
    !(
      x.options.length === scaleOptions.length &&
      x.options.every((opt, i) => opt === scaleOptions[i])
    ),
  "a non-scale multiple-choice question for the year level",
);

/** True when a question uses the repeated 5-point scale. */
export function isScaleQuestion(q: Question): boolean {
  return scaleQuestions.some((s) => s.entry_id === q.entry_id);
}

/**
 * Look up a question by its original Google entry id.
 *
 * Resolves against the whole instrument, not just the deployed subset, so a
 * stored answer to a question this rollout no longer asks can still be
 * labelled when reading historical responses.
 */
export function questionByEntryId(entryId: number): Question | undefined {
  return (
    allQuestions.find((q) => q.entry_id === entryId) ??
    sourceQuestions.find((q) => q.entry_id === entryId)
  );
}

/**
 * The section a question belongs to in the original form, or null for the
 * participant-detail questions that precede the first section header.
 */
export function sectionForQuestion(entryId: number): SurveySection | null {
  return sourceSections.find((s) => s.questions.some((q) => q.entry_id === entryId)) ?? null;
}

/* ------------------------------------------------------------------ *
 * Counts — used by the verification script and the admin dashboard
 * ------------------------------------------------------------------ */

export const surveyStats = {
  totalItems: surveySource.items.length,
  sectionCount: surveySections.length,
  questionCount: allQuestions.length,
  /** Questions in the official instrument, regardless of what this rollout asks. */
  sourceQuestionCount: sourceQuestions.length,
  /** Source questions this rollout withholds. 0 means the form is intact. */
  withheldQuestionCount: withheldQuestions.length,
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
