/**
 * The guided step sequence.
 *
 * The original form is a single page. Splitting it into steps is a presentation
 * choice only: the questions, their order, their wording and their options are
 * untouched, and every question still appears exactly once.
 *
 * Steps:
 *   0        participant details (the questions that precede the first section header)
 *   1..n     one step per original section block, in original order
 *   last     review before submit
 */
import {
  participantQuestions,
  surveySections,
  type Question,
  type SurveySection,
} from "./source";

export type StepKind = "details" | "section" | "review";

export type SurveyStep = {
  id: string;
  kind: StepKind;
  /** Short label for the progress rail. */
  label: string;
  /** Heading shown at the top of the step. */
  title: string;
  /** Sub-heading / description. Verbatim source text for section steps. */
  description: string | null;
  questions: Question[];
  section: SurveySection | null;
};

const detailsStep: SurveyStep = {
  id: "details",
  kind: "details",
  label: "You",
  title: "Your details",
  description:
    "So we can match this survey to the ones you will fill in at the end of each term.",
  questions: participantQuestions,
  section: null,
};

const sectionSteps: SurveyStep[] = surveySections.map((section) => ({
  id: `section-${section.order}`,
  kind: "section" as const,
  label: section.shortLabel,
  // The exact original section title.
  title: section.title,
  // The exact original section description.
  description: section.description,
  questions: section.questions,
  section,
}));

const reviewStep: SurveyStep = {
  id: "review",
  kind: "review",
  label: "Review",
  title: "Review your answers",
  description: "Check everything below, then submit. You can go back and change any answer.",
  questions: [],
  section: null,
};

export const surveySteps: SurveyStep[] = [detailsStep, ...sectionSteps, reviewStep];

export const REVIEW_STEP_INDEX = surveySteps.length - 1;

/** Field names validated by a given step (includes the email field on step 0). */
export function fieldsForStep(step: SurveyStep): string[] {
  const fields = step.questions.map((q) => q.fieldKey);
  return step.kind === "details" ? ["email", ...fields] : fields;
}
