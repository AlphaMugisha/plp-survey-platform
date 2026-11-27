/**
 * Required-field and optional-field validation, client and server.
 */
import { describe, expect, it } from "vitest";
import {
  buildSchemaFor,
  emailSchema,
  emptyFormValues,
  fullSurveySchema,
  schemaForQuestion,
  submissionSchema,
  validateSubmissionAnswers,
} from "@/lib/survey/schema";
import {
  sourceQuestions,
  nameQuestion,
  scaleOptions,
  schoolQuestion,
  sourceSchools,
  schools,
  yearLevelQuestion,
} from "@/lib/survey/source";

/** A complete, valid set of answers keyed by original entry id. */
function validAnswers(): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const q of sourceQuestions) {
    if (q.options?.length) answers[String(q.entry_id)] = q.options[0]!;
    else if (q.type === "paragraph") answers[String(q.entry_id)] = "A considered answer.";
    else answers[String(q.entry_id)] = "Alice Uwase";
  }
  return answers;
}

describe("email validation", () => {
  it("requires an email because the original form collects one", () => {
    expect(emailSchema.safeParse("").success).toBe(false);
    expect(emailSchema.safeParse(undefined).success).toBe(false);
  });

  it("rejects malformed addresses and accepts valid ones", () => {
    for (const bad of ["student", "student@", "@example.org", "a b@example.org"]) {
      expect(emailSchema.safeParse(bad).success).toBe(false);
    }
    expect(emailSchema.safeParse("student@example.org").success).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    const parsed = emailSchema.safeParse("  student@example.org  ");
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toBe("student@example.org");
  });
});

describe("required-field validation", () => {
  it("rejects a blank answer for every required question", () => {
    for (const question of sourceQuestions.filter((q) => q.required)) {
      const schema = schemaForQuestion(question);
      expect(schema.safeParse("").success).toBe(false);
      expect(schema.safeParse(undefined).success).toBe(false);
    }
  });

  it("rejects whitespace-only free text", () => {
    const schema = schemaForQuestion(nameQuestion);
    expect(schema.safeParse("   ").success).toBe(false);
  });

  it("gives a helpful message rather than a raw type error", () => {
    const rating = sourceQuestions.find((q) => q.options?.length === 5)!;
    const result = schemaForQuestion(rating).safeParse("");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.message).toBe("Please choose one of the options.");
    }

    const school = schemaForQuestion(schoolQuestion).safeParse("");
    expect(school.success).toBe(false);
    if (!school.success) {
      expect(school.error.issues[0]!.message).toBe(
        "Please select your school from the list.",
      );
    }
  });

  it("fails the whole-survey schema when any required answer is absent", () => {
    // fullSurveySchema covers the deployed form, whatever it currently asks.
    expect(fullSurveySchema.safeParse(emptyFormValues()).success).toBe(false);
  });
});

describe("optional-field validation", () => {
  const optional = sourceQuestions.find((q) => !q.required)!;

  it("accepts an empty answer for the one optional question", () => {
    const schema = schemaForQuestion(optional);
    expect(schema.safeParse("").success).toBe(true);
    expect(schema.safeParse(undefined).success).toBe(true);
  });

  it("still accepts a real answer for the optional question", () => {
    expect(schemaForQuestion(optional).safeParse("A little nervous.").success).toBe(true);
  });

  it("does not block submission when only the optional answer is missing", () => {
    const answers = validAnswers();
    delete answers[String(optional.entry_id)];
    expect(validateSubmissionAnswers(answers, sourceQuestions)).toEqual([]);
  });
});

describe("choice answers must be original option strings", () => {
  it("rejects a numeric value for a rating question", () => {
    const rating = sourceQuestions.find((q) => q.options?.length === 5)!;
    const schema = schemaForQuestion(rating);
    // The scale is literal strings — "3" is not a valid answer.
    expect(schema.safeParse("3").success).toBe(false);
    expect(schema.safeParse(scaleOptions[2]!).success).toBe(true);
  });

  it("rejects a paraphrased option", () => {
    const rating = sourceQuestions.find((q) => q.options?.length === 5)!;
    const schema = schemaForQuestion(rating);
    expect(schema.safeParse("3 - Neutral / Sometimes").success).toBe(false); // hyphen, not em dash
    expect(schema.safeParse("Neutral").success).toBe(false);
  });

  it("rejects a school that is not on the original list", () => {
    const schema = schemaForQuestion(schoolQuestion);
    expect(schema.safeParse("Some Other School").success).toBe(false);
    for (const name of schoolQuestion.options!) {
      expect(schema.safeParse(name).success).toBe(true);
    }
  });

  it("rejects a school name whose accents or casing were 'corrected'", () => {
    // Exactness, not availability: run this against the full official list so
    // it keeps testing what it is named for regardless of deployment overlay.
    const schema = schemaForQuestion({ ...schoolQuestion, options: sourceSchools });
    expect(schema.safeParse("College de l'Immaculee Conception").success).toBe(false);
    expect(schema.safeParse("Collège de l'Immaculée Conception").success).toBe(true);
    expect(schema.safeParse("College de la Paix").success).toBe(false);
    expect(schema.safeParse("COLLEGE DE LA PAIX").success).toBe(true);
  });

  it("rejects an invalid year level", () => {
    const schema = schemaForQuestion(yearLevelQuestion);
    const valid = yearLevelQuestion.options!;
    expect(schema.safeParse("Year 42").success).toBe(false);
    // Case matters: the stored value must match the option byte for byte.
    expect(schema.safeParse(valid[0]!.toLowerCase()).success).toBe(false);
    for (const level of valid) {
      expect(schema.safeParse(level).success).toBe(true);
    }
  });
});

describe("per-step validation", () => {
  it("validates only the fields on the given step", () => {
    const schema = buildSchemaFor([nameQuestion], false);
    const result = schema.safeParse({ [nameQuestion.fieldKey]: "Alice Uwase" });
    expect(result.success).toBe(true);
  });

  it("includes the email field when asked", () => {
    const schema = buildSchemaFor([nameQuestion], true);
    expect(schema.safeParse({ [nameQuestion.fieldKey]: "Alice" }).success).toBe(false);
    // The details step also collects the email and the country of origin.
    expect(
      schema.safeParse({
        [nameQuestion.fieldKey]: "Alice",
        email: "a@example.org",
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        [nameQuestion.fieldKey]: "Alice",
        email: "a@example.org",
        country_of_origin: "Rwanda",
      }).success,
    ).toBe(true);
  });
});

describe("server-side submission validation", () => {
  it("accepts a complete, valid submission", () => {
    expect(validateSubmissionAnswers(validAnswers(), sourceQuestions)).toEqual([]);
  });

  it("reports every missing required answer", () => {
    const issues = validateSubmissionAnswers({}, sourceQuestions);
    expect(issues).toHaveLength(27);
    expect(issues.every((i) => i.entryId !== null)).toBe(true);
  });

  it("rejects an answer that is not one of the question's options", () => {
    const answers = validAnswers();
    const rating = sourceQuestions.find((q) => q.options?.length === 5)!;
    answers[String(rating.entry_id)] = "1";

    const issues = validateSubmissionAnswers(answers, sourceQuestions);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toMatch(/not one of the allowed options/i);
  });

  it("rejects unknown question ids rather than dropping them", () => {
    const answers = { ...validAnswers(), "999999999": "injected" };
    const issues = validateSubmissionAnswers(answers, sourceQuestions);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toMatch(/Unknown question id/);
  });

  it("enforces a length limit on free text", () => {
    const answers = validAnswers();
    const paragraph = sourceQuestions.find((q) => q.type === "paragraph")!;
    answers[String(paragraph.entry_id)] = "x".repeat(5001);
    expect(validateSubmissionAnswers(answers, sourceQuestions)[0]!.message).toMatch(/character limit/);
  });

  it("validates the submission envelope", () => {
    const ok = submissionSchema.safeParse({
      surveySlug: "plp-survey-1-baseline-term-1",
      email: "student@example.org",
      countryOfOrigin: "Rwanda",
      answers: validAnswers(),
    });
    expect(ok.success).toBe(true);

    expect(
      submissionSchema.safeParse({ surveySlug: "", email: "x", answers: {} }).success,
    ).toBe(false);
  });
});
