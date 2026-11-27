/**
 * Withholding questions from a deployment.
 *
 * `data/survey-source.json` is the verified extract of PLP's Google Form and is
 * never edited for one rollout. A rollout that asks only part of the instrument
 * DECLARES which questions it asks, in `data/deployment.json`. The rest are
 * withheld: still in the source, still verified, absent from the form.
 *
 * What these tests pin down:
 *   - the instrument stays whole and reachable
 *   - a withheld question never reaches an applicant
 *   - nothing can be asked that is not in the source
 *   - clearing the declaration restores the full form, sections and all
 */
import { describe, expect, it } from "vitest";
import {
  allQuestions,
  askedEntryIds,
  isAsked,
  nameQuestion,
  participantQuestions,
  schoolQuestion,
  sourceQuestions,
  sourceSections,
  surveySections,
  withheldQuestions,
  yearLevelQuestion,
} from "@/lib/survey/source";
import { stepsForQuestions, surveySteps } from "@/lib/survey/steps";
import { validateSubmissionAnswers } from "@/lib/survey/schema";

describe("the instrument stays whole", () => {
  it("keeps all 28 questions and 5 sections in the source", () => {
    expect(sourceQuestions).toHaveLength(28);
    expect(sourceSections).toHaveLength(5);
  });

  it("accounts for every source question as either asked or withheld", () => {
    expect(allQuestions.length + withheldQuestions.length).toBe(sourceQuestions.length);

    const asked = new Set(allQuestions.map((q) => q.entry_id));
    const held = new Set(withheldQuestions.map((q) => q.entry_id));
    for (const q of sourceQuestions) {
      expect(asked.has(q.entry_id) !== held.has(q.entry_id), q.title).toBe(true);
    }
  });

  it("withholds a question verbatim, so it can come back unchanged", () => {
    const byEntryId = new Map(sourceQuestions.map((q) => [q.entry_id, q]));
    for (const q of withheldQuestions) {
      expect(q).toEqual(byEntryId.get(q.entry_id));
    }
  });
});

describe("a deployment can only narrow, never invent", () => {
  it("asks nothing that is absent from the source", () => {
    const sourceIds = new Set(sourceQuestions.map((q) => q.entry_id));
    for (const id of askedEntryIds) {
      expect(sourceIds.has(id), `entry ${id} is not in the source`).toBe(true);
    }
  });

  it("still resolves the instrument's identity questions when it asks none", () => {
    // This deployment withholds all 28 — the admin's own first question
    // collects the applicant's name and class. The anchors must still resolve,
    // because the submission route and the dashboard refer to them.
    expect(participantQuestions).toHaveLength(3);
    expect(nameQuestion.title).toBe("Full Name");
    expect(yearLevelQuestion.title).toBe("Year Level");
  });

  it("keeps the deployment's single school resolvable even unasked", () => {
    // Nobody is asked which school they attend, but there is still exactly one
    // answer, and the submission route records it.
    expect(isAsked(schoolQuestion.entry_id)).toBe(false);
    expect(schoolQuestion.options).toEqual(["New Generation Academy"]);
  });
});

describe("a withheld question never reaches an applicant", () => {
  it("is absent from every step of the form", () => {
    const shown = new Set(surveySteps.flatMap((s) => s.questions.map((q) => q.entry_id)));
    for (const q of withheldQuestions) {
      expect(shown.has(q.entry_id), `"${q.title}" is still on the form`).toBe(false);
    }
  });

  it("leaves no empty section behind", () => {
    for (const section of surveySections) {
      expect(section.questions.length, `"${section.title}" is empty`).toBeGreaterThan(0);
    }
  });

  it("is not demanded by submission validation", () => {
    const answers: Record<string, string> = {};
    for (const q of allQuestions) {
      answers[String(q.entry_id)] = q.options?.length ? q.options[0]! : "An answer.";
    }
    // A complete set of ASKED answers is a valid submission, even though 25
    // source questions have no answer at all.
    expect(validateSubmissionAnswers(answers)).toEqual([]);
  });

  it("is still rejected if an applicant somehow sends one", () => {
    const withheld = withheldQuestions[0];
    if (!withheld) return; // nothing withheld: the full form is deployed
    const answers: Record<string, string> = {};
    for (const q of allQuestions) {
      answers[String(q.entry_id)] = q.options?.length ? q.options[0]! : "An answer.";
    }
    answers[String(withheld.entry_id)] = "Smuggled answer.";

    // Withholding is enforced, not merely presentational: the server rejects an
    // answer to a question this deployment does not ask, rather than storing it.
    const issues = validateSubmissionAnswers(answers);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.field).toBe(String(withheld.entry_id));
    expect(issues[0]!.message).toMatch(/Unknown question id/u);
  });
});

describe("the way back is open", () => {
  it("lays out the whole instrument again when every question is asked", () => {
    const full = stepsForQuestions(sourceQuestions);
    expect(full.filter((s) => s.kind === "section")).toHaveLength(5);

    const shown = full.flatMap((s) => s.questions.map((q) => q.entry_id));
    expect(shown).toEqual(sourceQuestions.map((q) => q.entry_id));
  });

  it("puts admin-added questions after the applicant's details", () => {
    const added = {
      index: 9_000,
      entry_id: 9_000_001,
      type: "paragraph" as const,
      title: "Why do you want to join?",
      description: null,
      required: true,
      fieldKey: "q_9000001",
    };
    const steps = stepsForQuestions([...allQuestions, added]);

    expect(steps[0]!.kind).toBe("details");
    expect(steps.at(-1)!.kind).toBe("review");

    // This deployment asks none of the source questions, so the admin's own
    // question is the entire answerable form.
    const titles = steps.flatMap((s) => s.questions.map((q) => q.title));
    expect(titles).toEqual(["Why do you want to join?"]);
  });
});
