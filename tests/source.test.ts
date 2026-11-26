/**
 * Source JSON parsing + exact content verification.
 *
 * These read the raw file independently of the app's loader, so a bug in the
 * loader cannot mask itself.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  allQuestions,
  sourceQuestions,
  sourceSchools,
  sourceYearLevels,
  headerParagraphs,
  nameQuestion,
  participantQuestions,
  scaleOptions,
  scaleQuestions,
  schoolQuestion,
  schools,
  surveySections,
  surveySource,
  surveyStats,
  yearLevelQuestion,
  isScaleQuestion,
  questionByEntryId,
  sectionForQuestion,
} from "@/lib/survey/source";
import { surveySteps, fieldsForStep } from "@/lib/survey/steps";

type RawItem = {
  index: number;
  type: string;
  title: string;
  description: string | null;
  entry_id?: number;
  required?: boolean;
  options?: string[];
};

const raw = JSON.parse(
  readFileSync(join(process.cwd(), "data", "survey-source.json"), "utf8"),
) as {
  form_title: string;
  header_description: string;
  confirmation_message: string;
  collects_email: { enabled: boolean; required: boolean };
  items: RawItem[];
};

const rawSections = raw.items.filter((i) => i.type === "section_header");
const rawQuestions = raw.items.filter((i) => i.type !== "section_header");
const rawSchools = raw.items.find((i) => i.type === "dropdown")?.options ?? [];

describe("source JSON parsing", () => {
  it("loads and validates the source file", () => {
    expect(surveySource.form_title).toBe(raw.form_title);
    expect(surveySource.items).toHaveLength(raw.items.length);
  });

  it("has the verified structure: 33 items = 5 sections + 28 questions", () => {
    expect(raw.items).toHaveLength(33);
    expect(surveyStats.sectionCount).toBe(5);
    expect(surveyStats.questionCount).toBe(28);
  });

  it("has 27 required and 1 optional question", () => {
    expect(surveyStats.requiredCount).toBe(27);
    expect(surveyStats.optionalCount).toBe(1);
  });

  it("has 180 schools in the source and 21 rating questions", () => {
    expect(sourceSchools).toHaveLength(180);
    expect(surveyStats.scaleQuestionCount).toBe(21);
  });

  it("records the required built-in email collection", () => {
    expect(surveyStats.collectsEmail).toBe(true);
    expect(surveySource.collects_email.required).toBe(true);
  });

  it("splits the header description without altering it", () => {
    expect(headerParagraphs.join("\n\n")).toBe(raw.header_description.trim());
    expect(headerParagraphs).toHaveLength(3);
  });
});

describe("exact content verification", () => {
  it("preserves every section title and description verbatim", () => {
    expect(surveySections).toHaveLength(rawSections.length);
    rawSections.forEach((rawSection, i) => {
      expect(surveySections[i]!.title).toBe(rawSection.title);
      expect(surveySections[i]!.description).toBe(rawSection.description);
    });
  });

  it("preserves every question's wording, help text and entry id verbatim", () => {
    expect(allQuestions).toHaveLength(rawQuestions.length);
    rawQuestions.forEach((rawQuestion, i) => {
      const q = allQuestions[i]!;
      expect(q.title).toBe(rawQuestion.title);
      expect(q.description).toBe(rawQuestion.description);
      expect(q.entry_id).toBe(rawQuestion.entry_id);
      expect(q.type).toBe(rawQuestion.type);
      expect(q.required).toBe(rawQuestion.required);
    });
  });

  it("preserves original question ordering", () => {
    const appOrder = allQuestions.map((q) => q.index);
    const rawOrder = rawQuestions.map((q) => q.index);
    expect(appOrder).toEqual(rawOrder);
    // and the indices are strictly increasing
    expect([...appOrder].sort((a, b) => a - b)).toEqual(appOrder);
  });

  it("preserves every answer option exactly and in order", () => {
    // Compared against the PRISTINE questions: a deployment overlay may
    // legitimately replace the school and year-level options on purpose.
    rawQuestions.forEach((rawQuestion, i) => {
      expect(sourceQuestions[i]!.options ?? null).toEqual(rawQuestion.options ?? null);
    });
  });

  it("preserves all 180 school names exactly and in original order", () => {
    expect(sourceSchools).toEqual(rawSchools);
  });

  it("keeps accents, inconsistent casing and original typos in school names", () => {
    // Values that would be silently "corrected" by well-meaning editing.
    expect(sourceSchools).toContain("Collège de l'Immaculée Conception");
    expect(sourceSchools).toContain("COLLEGE DE LA PAIX");
    expect(sourceSchools).toContain("Ecole Tecnique de Kabgayi");
    expect(sourceSchools).toContain("saint Mary's high school kiruhura");
    expect(sourceSchools).toContain("Groupe Scolaire Mère Du Verbe kibeho");
  });

  it("keeps the rating options as literal strings, never numbers", () => {
    expect(scaleOptions).toEqual([
      "1 — Strongly Disagree / Not at all",
      "2 — Disagree / A little",
      "3 — Neutral / Sometimes",
      "4 — Agree / Often",
      "5 — Strongly Agree / Always",
    ]);
    for (const option of scaleOptions) {
      expect(typeof option).toBe("string");
      expect(Number.isNaN(Number(option))).toBe(true);
    }
  });

  it("keeps '(Optional)' inside the optional question's own wording", () => {
    const optional = allQuestions.filter((q) => !q.required);
    expect(optional).toHaveLength(1);
    expect(optional[0]!.title).toBe(
      "Is there anything you are worried or unsure about as you start this program? (Optional)",
    );
  });

  it("preserves the exact confirmation message", () => {
    expect(surveySource.confirmation_message).toBe(raw.confirmation_message);
    expect(surveySource.confirmation_message).toContain("Lead with peace");
  });
});

describe("derived structure", () => {
  it("identifies the three participant-detail questions before the first section", () => {
    expect(participantQuestions).toHaveLength(3);
    expect(participantQuestions.map((q) => q.title)).toEqual([
      "Full Name",
      "School Name",
      "Year Level",
    ]);
  });

  it("identifies the name, school and year-level questions structurally", () => {
    expect(nameQuestion.type).toBe("short_answer");
    expect(schoolQuestion.type).toBe("dropdown");
    // Effective options follow the deployment overlay; the official lists are
    // asserted separately above.
    expect(schoolQuestion.options!.length).toBeGreaterThan(0);
    expect(sourceYearLevels).toEqual(["S1", "S2", "S3", "S4", "S5", "S6"]);
  });

  it("excludes Year Level from the rating questions", () => {
    expect(isScaleQuestion(yearLevelQuestion)).toBe(false);
    expect(scaleQuestions).toHaveLength(21);
    expect(scaleQuestions.every((q) => q.options?.length === 5)).toBe(true);
  });

  it("assigns every section question to its section", () => {
    const totalInSections = surveySections.reduce((n, s) => n + s.questions.length, 0);
    expect(totalInSections + participantQuestions.length).toBe(allQuestions.length);
  });

  it("maps a question back to its section", () => {
    const first = surveySections[0]!.questions[0]!;
    expect(sectionForQuestion(first.entry_id)?.title).toBe(surveySections[0]!.title);
    // participant questions belong to no section
    expect(sectionForQuestion(nameQuestion.entry_id)).toBeNull();
  });

  it("looks questions up by original entry id", () => {
    for (const q of allQuestions) {
      expect(questionByEntryId(q.entry_id)?.title).toBe(q.title);
    }
    expect(questionByEntryId(-1)).toBeUndefined();
  });

  it("derives short section labels A1, A2, A3, B, C", () => {
    expect(surveySections.map((s) => s.shortLabel)).toEqual(["A1", "A2", "A3", "B", "C"]);
  });
});

describe("guided step layout preserves the survey", () => {
  it("has 7 steps: details, 5 sections, review", () => {
    expect(surveySteps).toHaveLength(7);
    expect(surveySteps[0]!.kind).toBe("details");
    expect(surveySteps.at(-1)!.kind).toBe("review");
    expect(surveySteps.filter((s) => s.kind === "section")).toHaveLength(5);
  });

  it("covers all 28 questions exactly once, in original order", () => {
    const stepped = surveySteps.flatMap((s) => s.questions.map((q) => q.entry_id));
    expect(stepped).toHaveLength(28);
    expect(new Set(stepped).size).toBe(28);
    expect(stepped).toEqual(rawQuestions.map((q) => q.entry_id));
  });

  it("validates the email field on the first step only", () => {
    expect(fieldsForStep(surveySteps[0]!)).toContain("email");
    for (const step of surveySteps.slice(1)) {
      expect(fieldsForStep(step)).not.toContain("email");
    }
  });

  it("uses the exact original section title for each section step", () => {
    const sectionSteps = surveySteps.filter((s) => s.kind === "section");
    sectionSteps.forEach((step, i) => {
      expect(step.title).toBe(rawSections[i]!.title);
      expect(step.description).toBe(rawSections[i]!.description);
    });
  });
});
