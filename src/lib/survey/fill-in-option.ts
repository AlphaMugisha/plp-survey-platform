/**
 * Fill-in-the-blank answer options.
 *
 * PLP's questionnaire offers `Other: __________` on five questions. The run of
 * underscores is a blank to be filled — that is what it means on paper — so the
 * option is kept EXACTLY as written and the blank is what the applicant types
 * into.
 *
 * A chosen fill-in answer is stored as the option with the blank replaced:
 *
 *     option stored in `questions.options`   "Other: __________"
 *     what the applicant typed              "Debate club"
 *     what lands in `answers.answer_text`   "Other: Debate club"
 *
 * That keeps one answer in one column, reads correctly in the dashboard and in
 * a CSV export, and needs no extra question. Validation accepts either an exact
 * option or a filled-in one, and nothing else.
 *
 * Any option ending in a run of two or more underscores works this way, so a
 * question an admin writes later behaves the same without code changes.
 */
import type { Question } from "./source";

/** Matches an option that ends in a blank, capturing the text before it. */
const BLANK = /^(.*?)_{2,}\s*$/u;

/** How much an applicant may type into a blank. */
export const MAX_FILL_IN = 200;

/**
 * The lead-in text of a fill-in option, or null when it is an ordinary option.
 *
 * `"Other: __________"` -> `"Other: "`
 */
export function fillInPrefix(option: string): string | null {
  const match = BLANK.exec(option);
  if (!match) return null;
  // A bare run of underscores with no label is still a blank, but has no
  // prefix to echo back, so it is treated as an ordinary option.
  return match[1]!.length > 0 ? match[1]! : null;
}

/** The question's fill-in option, when it has one. Questions have at most one. */
export function fillInOption(q: Question): string | null {
  return q.options?.find((option) => fillInPrefix(option) !== null) ?? null;
}

/**
 * Split a stored answer into the option that was chosen and the typed text.
 *
 * Returns null when this answer is not a fill-in one, so callers can treat
 * ordinary options exactly as before.
 */
export function splitFillIn(
  q: Question,
  value: string,
): { option: string; prefix: string; text: string } | null {
  const option = fillInOption(q);
  if (!option) return null;

  const prefix = fillInPrefix(option)!;

  // The untouched option means "chose Other, typed nothing yet".
  if (value === option) return { option, prefix, text: "" };

  // Matched without the prefix's trailing space, because the submission route
  // trims every answer before validating it — so "Other: " arrives as "Other:".
  const stem = prefix.trimEnd();
  if (!value.startsWith(stem)) return null;

  return { option, prefix, text: value.slice(stem.length).trim() };
}

/** Build the stored answer for a filled-in option. */
export function composeFillIn(prefix: string, text: string): string {
  return `${prefix}${text}`;
}

/**
 * Whether a value is an acceptable answer to a choice question.
 *
 * Exactly one of:
 *   - one of the question's own option strings, unchanged
 *   - that question's fill-in option with something written in the blank
 */
export function isAcceptableChoice(q: Question, value: string): boolean {
  const blank = fillInOption(q);

  // An exact option is fine — EXCEPT the fill-in option itself. Submitting
  // "Other: __________" means the blank was never filled, which is not an
  // answer however it reached us.
  if (q.options?.includes(value)) return value !== blank;

  const split = splitFillIn(q, value);
  if (!split) return false;

  const text = split.text.trim();
  return text.length > 0 && text.length <= MAX_FILL_IN;
}

/**
 * Why a fill-in answer is not acceptable, or null when it is fine.
 * Separated from `isAcceptableChoice` so the message can be specific.
 */
export function fillInIssue(q: Question, value: string): string | null {
  const split = splitFillIn(q, value);
  if (!split) return null;

  const text = split.text.trim();
  if (text.length === 0) {
    return `Please say what "${split.prefix.trim()}" means for you.`;
  }
  if (text.length > MAX_FILL_IN) {
    return `Please keep this under ${MAX_FILL_IN} characters.`;
  }
  return null;
}
