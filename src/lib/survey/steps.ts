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
import { isApplication, labels } from "./framing";
import {
  askedParticipantQuestions,
  participantQuestions,
  sourceQuestions,
  sourceSections,
  surveySections,
  type Question,
  type QuestionGroup,
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
  description: isApplication
    ? "So we know who the application belongs to and can get back to you."
    : "So we can match this survey to the ones you will fill in at the end of each term.",
  questions: askedParticipantQuestions,
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
  title: labels.reviewTitle,
  description: "Check everything below, then submit. You can go back and change any answer.",
  questions: [],
  section: null,
};

export const surveySteps: SurveyStep[] = [detailsStep, ...sectionSteps, reviewStep];

/**
 * Build the step sequence for an arbitrary question set — the live path, since
 * the questions come from the database and include anything an admin added.
 *
 * The order is always: the applicant's details, then each original section
 * that still has a question in the set, then the admin's own questions, then
 * review. A section with nothing left in it is dropped rather than rendered
 * as an empty heading.
 */
export function stepsForQuestions(questions: Question[]): SurveyStep[] {
  const participantIds = new Set(participantQuestions.map((question) => question.entry_id));
  const byEntryId = new Map(questions.map((question) => [question.entry_id, question]));

  const details: SurveyStep = {
    ...detailsStep,
    questions: participantQuestions.filter((question) => byEntryId.has(question.entry_id)),
  };

  // Original section questions, kept in their own sections and in source order.
  // Built from the INSTRUMENT's section structure, filtered by what is actually
  // present, rather than from the incoming order — so a database row can never
  // reorder the verified form, and clearing the deployment overlay restores
  // every section without touching this function.
  const sections: SurveyStep[] = sourceSections
    .map((section) => ({
      id: `section-${section.order}`,
      kind: "section" as const,
      label: section.shortLabel,
      title: section.title,
      description: section.description,
      questions: section.questions.filter((question) => byEntryId.has(question.entry_id)),
      section,
    }))
    .filter((step) => step.questions.length > 0);

  // Anything not in the verified source is a question an admin added.
  const sourceIds = new Set(sourceQuestions.map((question) => question.entry_id));
  const additionalQuestions = questions.filter(
    (question) => !sourceIds.has(question.entry_id) && !participantIds.has(question.entry_id),
  );

  // Admin questions are laid out in the GROUPS the administrator created, one
  // step per group, in group order. A long questionnaire is far easier to fill
  // in as named parts than as one list, and the group's own description carries
  // text like the final agreement.
  const grouped = new Map<string, { group: QuestionGroup; questions: Question[] }>();
  const ungrouped: Question[] = [];

  for (const question of additionalQuestions) {
    const group = question.group;
    if (!group) {
      ungrouped.push(question);
      continue;
    }
    const bucket = grouped.get(group.id);
    if (bucket) bucket.questions.push(question);
    else grouped.set(group.id, { group, questions: [question] });
  }

  const groupSteps: SurveyStep[] = [...grouped.values()]
    .sort((a, b) => a.group.order - b.group.order)
    .map(({ group, questions: inGroup }) => ({
      id: `group-${group.id}`,
      kind: "section" as const,
      label: group.shortLabel,
      title: group.title,
      description: group.description,
      questions: inGroup,
      section: null,
    }));

  // Questions the admin added without a group keep their own trailing step, so
  // they are never silently dropped just because they are not in a part.
  const additional: SurveyStep[] =
    ungrouped.length === 0
      ? []
      : [
          {
            id: "additional-questions",
            kind: "section",
            label: sections.length + groupSteps.length > 0 ? "More" : "Questions",
            title:
              sections.length + groupSteps.length > 0
                ? "Additional questions"
                : "A few questions",
            description: null,
            questions: ungrouped,
            section: null,
          },
        ];

  return [details, ...sections, ...groupSteps, ...additional, reviewStep];
}

export const REVIEW_STEP_INDEX = surveySteps.length - 1;

/** Field names validated by a given step (includes the email field on step 0). */
export function fieldsForStep(step: SurveyStep): string[] {
  const fields = step.questions.map((q) => q.fieldKey);
  return step.kind === "details" ? ["email", "country_of_origin", ...fields] : fields;
}
