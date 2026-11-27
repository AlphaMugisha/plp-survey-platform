/**
 * The wrapper language around the survey.
 *
 * The 28 questions, their options and the form's own title and confirmation
 * message are SOURCE CONTENT and are never touched by this. What this controls
 * is the chrome a deployment puts around them: headings, button labels, the
 * word used for a submission.
 *
 * The same instrument is used two ways:
 *
 *   survey      (default)  — the mid-programme baseline, filled in by students
 *                            already on the PLP programme
 *   application (overlay)  — a recruitment drive, where students are applying
 *                            to join a club
 *
 * Clearing `framing` from `data/deployment.json` returns every label below to
 * its survey wording, with no code change.
 */
import { deployment, surveySource } from "./source";

export type FramingMode = "survey" | "application";

export type FramingLabels = {
  /** "survey" / "application" — used mid-sentence. */
  noun: string;
  nounPlural: string;
  /** Primary call to action. */
  cta: string;
  /** Short call to action, for tight spaces like a sticky bar. */
  ctaShort: string;
  /** The page's own headline. Not the form title — that is source content. */
  headline: string;
  /** One sentence under the headline. */
  lede: string;
  /** Small label above the headline. */
  eyebrow: string;
  /** The final submit button. */
  submit: string;
  /** Heading on the confirmation screen. */
  successTitle: string;
  /** Supporting line on the confirmation screen. */
  successBody: string;
  /** Heading on the review step. */
  reviewTitle: string;
};

/** Defaults: the instrument used as what it originally is, a survey. */
const SURVEY_DEFAULTS: FramingLabels = {
  noun: "survey",
  nounPlural: "surveys",
  cta: "Start the survey",
  ctaShort: "Start the survey",
  headline: surveySource.form_title,
  lede: "A short, honest snapshot of where you are today — before the PLP programme begins. No right answers. No marks.",
  eyebrow: "PLP School Curriculum",
  submit: "Submit survey",
  successTitle: "Your survey is in",
  successBody: "Your answers have been saved. You do not need to do anything else.",
  reviewTitle: "Review your answers",
};

export const framingMode: FramingMode = deployment.framing?.mode ?? "survey";

/** Deployment labels layered over the defaults; anything unset falls back. */
export const labels: FramingLabels = {
  ...SURVEY_DEFAULTS,
  ...(deployment.framing?.labels ?? {}),
};

export const isApplication = framingMode === "application";

/** Who this deployment is aimed at, when it is aimed at anyone in particular. */
export const audience: string | null = deployment.framing?.audience ?? null;

/**
 * The small label above the headline, for a given application status.
 *
 * `labels.eyebrow` announces that applications are OPEN, so it must never be
 * shown next to a banner saying they are closed — the page would contradict
 * itself in two adjacent lines. When the window is shut, the eyebrow falls back
 * to naming the thing instead of advertising it.
 */
export function eyebrowFor(status: string | undefined): string {
  if (!isApplication) return labels.eyebrow;
  return status === "open" ? labels.eyebrow : `PLP club ${labels.noun}`;
}

/**
 * Capitalise a label for use at the start of a sentence, without touching
 * labels that are already capitalised or are proper nouns.
 */
export function sentenceCase(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
