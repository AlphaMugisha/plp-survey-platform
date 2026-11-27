/**
 * Validation schemas, generated from the survey source.
 *
 * Required/optional status and the set of acceptable answers both come from
 * `survey-source.json` — a multiple-choice answer must be one of that question's
 * exact original option strings, and a school must be one of the 180 original names.
 * The same schema is used client-side (React Hook Form) and server-side (API route).
 */
import { z } from "zod";
import { allQuestions, surveySource, type Question } from "./source";

export const EMAIL_FIELD = "email" as const;
export const COUNTRY_FIELD = "country_of_origin" as const;

const MAX_SHORT = 300;
const MAX_PARAGRAPH = 5000;

function requiredMessage(q: Question): string {
  switch (q.type) {
    case "multiple_choice":
      return "Please choose one of the options.";
    case "dropdown":
      return "Please select your school from the list.";
    default:
      return "This answer is required.";
  }
}

/** Zod schema for one question's answer value. */
export function schemaForQuestion(q: Question): z.ZodType<string | undefined> {
  // Choice questions: the answer must be one of the exact original option strings.
  if (q.options && q.options.length > 0) {
    const allowed = new Set(q.options);
    const base = z
      .string({ required_error: requiredMessage(q), invalid_type_error: requiredMessage(q) })
      .refine((v) => allowed.has(v), {
        message:
          q.type === "dropdown"
            ? "Please select your school from the list."
            : "Please choose one of the options.",
      });
    return q.required
      ? (base as z.ZodType<string | undefined>)
      : (base.or(z.literal("")).optional() as z.ZodType<string | undefined>);
  }

  // Free-text questions.
  const max = q.type === "paragraph" ? MAX_PARAGRAPH : MAX_SHORT;
  const text = z
    .string({ required_error: requiredMessage(q), invalid_type_error: requiredMessage(q) })
    .transform((v) => v.trim());

  if (q.required) {
    return text.pipe(
      z
        .string()
        .min(q.type === "paragraph" ? 2 : 2, { message: requiredMessage(q) })
        .max(max, { message: `Please keep this under ${max} characters.` }),
    ) as z.ZodType<string | undefined>;
  }

  return text.pipe(
    z.string().max(max, { message: `Please keep this under ${max} characters.` }),
  ).optional() as z.ZodType<string | undefined>;
}

/** The email field required by the form's built-in email collection. */
export const emailSchema = surveySource.collects_email.required
  ? z
      .string({ required_error: "Your email address is required." })
      .trim()
      .min(1, { message: "Your email address is required." })
      .email({ message: "Please enter a valid email address." })
      .max(320, { message: "That email address is too long." })
  : z.string().trim().email().max(320).optional();

export const countrySchema = z
  .string({ required_error: "Please enter the country you are from." })
  .trim()
  .min(1, { message: "Please enter the country you are from." })
  .max(100, { message: "Please keep the country name under 100 characters." });

/** Schema covering a specific subset of questions — used for per-step validation. */
export function buildSchemaFor(questions: Question[], includeEmail = false) {
  const shape: Record<string, z.ZodTypeAny> = {};
  if (includeEmail) {
    shape[EMAIL_FIELD] = emailSchema;
    shape[COUNTRY_FIELD] = countrySchema;
  }
  for (const q of questions) shape[q.fieldKey] = schemaForQuestion(q);
  return z.object(shape);
}

/** Schema covering the whole survey (email + all 28 questions). */
export const fullSurveySchema = buildSchemaFor(allQuestions, true);

export type SurveyFormValues = Record<string, string | undefined> & {
  email?: string;
  country_of_origin?: string;
};

/**
 * Default form values, so inputs stay controlled.
 *
 * A choice question with exactly ONE option is answered in advance: there is no
 * decision to make, and asking for one is just friction. This happens when a
 * deployment pins the school list to a single school.
 */
export function emptyFormValues(questions: Question[] = allQuestions): SurveyFormValues {
  const values: SurveyFormValues = { [EMAIL_FIELD]: "", [COUNTRY_FIELD]: "" };
  for (const q of questions) {
    values[q.fieldKey] = q.options?.length === 1 ? q.options[0]! : "";
  }
  return values;
}

/* ------------------------------------------------------------------ *
 * Server-side submission payload
 * ------------------------------------------------------------------ */

/**
 * What the API route accepts. Answers are keyed by the ORIGINAL Google entry id
 * (as a string, because JSON object keys are strings) so the payload is
 * self-describing and cannot drift from the source.
 */
export const submissionSchema = z.object({
  surveySlug: z.string().min(1),
  email: emailSchema,
  countryOfOrigin: countrySchema,
  answers: z.record(z.string(), z.string()),
  meta: z
    .object({
      startedAt: z.string().optional(),
      durationSeconds: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

export type SubmissionPayload = z.infer<typeof submissionSchema>;

export type ValidationIssue = { entryId: number | null; field: string; message: string };

/**
 * Authoritative server-side check of a submission's answers against the source.
 * Returns the issues found; an empty array means the submission is valid.
 */
export function validateSubmissionAnswers(
  answers: Record<string, string>,
  questions: Question[] = allQuestions,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const q of questions) {
    const raw = answers[String(q.entry_id)];
    const value = typeof raw === "string" ? raw.trim() : "";

    if (!value) {
      if (q.required) {
        issues.push({ entryId: q.entry_id, field: q.fieldKey, message: requiredMessage(q) });
      }
      continue;
    }

    if (q.options && q.options.length > 0 && !q.options.includes(value)) {
      issues.push({
        entryId: q.entry_id,
        field: q.fieldKey,
        message: "Answer is not one of the allowed options for this question.",
      });
      continue;
    }

    const max = q.type === "paragraph" ? MAX_PARAGRAPH : MAX_SHORT;
    if (value.length > max) {
      issues.push({
        entryId: q.entry_id,
        field: q.fieldKey,
        message: `Answer exceeds the ${max} character limit.`,
      });
    }
  }

  // Reject unknown entry ids rather than silently dropping them.
  const knownIds = new Set(questions.map((q) => String(q.entry_id)));
  for (const key of Object.keys(answers)) {
    if (!knownIds.has(key)) {
      issues.push({
        entryId: null,
        field: key,
        message: `Unknown question id "${key}".`,
      });
    }
  }

  return issues;
}
