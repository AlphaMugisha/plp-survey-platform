/**
 * The framing overlay.
 *
 * The same instrument is used two ways: as the mid-programme baseline survey
 * it was written as, and as a club application. Framing changes the WRAPPER —
 * headings, button labels, the word used for a submission. It must never reach
 * the questions, their options, or the section text.
 *
 * These tests pin that boundary down, and pin down that clearing `framing`
 * from data/deployment.json reverts the wording with no code change.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  labels,
  framingMode,
  isApplication,
  sentenceCase,
  eyebrowFor,
} from "@/lib/survey/framing";
import { allQuestions, sourceQuestions, surveySource, deployment } from "@/lib/survey/source";
import { surveySteps } from "@/lib/survey/steps";

const srcDir = join(process.cwd(), "src");

describe("framing never reaches the content", () => {
  it("leaves every question's wording identical to the source", () => {
    allQuestions.forEach((q, i) => {
      expect(q.title).toBe(sourceQuestions[i]!.title);
      expect(q.description).toBe(sourceQuestions[i]!.description);
    });
  });

  it("does not put any framing label into a question or option", () => {
    const wrapper = [labels.headline, labels.lede, labels.eyebrow, labels.cta];
    for (const q of allQuestions) {
      for (const text of wrapper) {
        expect(q.title, `"${text}" leaked into a question`).not.toContain(text);
      }
      for (const option of q.options ?? []) {
        expect(wrapper).not.toContain(option);
      }
    }
  });

  it("keeps the form's own title and confirmation message in the source", () => {
    // The instrument keeps its real name in the data, the admin and the
    // verification report even when applicants never see it.
    expect(surveySource.form_title).toBe("PLP Survey 1 — Baseline (Beginning of Term 1)");
  });
});

describe("the active deployment is framed as an application", () => {
  it("is in application mode", () => {
    expect(framingMode).toBe("application");
    expect(isApplication).toBe(true);
  });

  it("gives a reason, so the deviation is not silent", () => {
    expect(deployment.framing?.reason?.length ?? 0).toBeGreaterThan(20);
  });

  it("heads the page with what the reader is doing, not the instrument's name", () => {
    expect(labels.headline).not.toBe(surveySource.form_title);
    expect(labels.headline).not.toMatch(/Term 1|Baseline|Survey 1/u);
  });

  it("asks the reader to apply, not to take a survey", () => {
    expect(labels.cta).toMatch(/appl/iu);
    expect(labels.submit).toMatch(/appl/iu);
    expect(labels.noun).toBe("application");
  });

  it("names the review step and the confirmation in the same language", () => {
    expect(labels.reviewTitle).toMatch(/appl/iu);
    expect(labels.successTitle).toMatch(/appl/iu);
  });
});

describe("the review step takes its heading from the framing", () => {
  it("does not hardcode survey wording", () => {
    const review = surveySteps[surveySteps.length - 1]!;
    expect(review.title).toBe(labels.reviewTitle);
  });
});

describe("participant-facing surfaces go through the framing module", () => {
  const read = (p: string) => readFileSync(join(srcDir, p), "utf8");

  // Each entry: the file, and the survey-only string it must not hardcode.
  const surfaces: Array<[string, string]> = [
    ["app/page.tsx", "Start the survey"],
    ["components/survey/survey-form.tsx", "Submit survey"],
    ["app/survey/thank-you/page.tsx", "Your survey is in"],
    ["lib/survey/steps.ts", '"Review your answers"'],
  ];

  for (const [file, hardcoded] of surfaces) {
    it(`${file} does not hardcode "${hardcoded}"`, () => {
      expect(read(file)).not.toContain(hardcoded);
    });
  }

  it("each of those files imports the framing labels", () => {
    for (const [file] of surfaces) {
      expect(read(file), `${file} must use the labels`).toMatch(
        // either the aliased path or the sibling one
        /from "(@\/lib\/survey|\.)\/framing"/u,
      );
    }
  });
});

describe("clearing the overlay reverts the wording", () => {
  // The defaults live in framing.ts rather than in deployment.json, so an
  // empty overlay is a working survey, not a page of blanks.
  const source = readFileSync(join(srcDir, "lib", "survey", "framing.ts"), "utf8");

  it("keeps a full set of survey defaults in code", () => {
    for (const key of Object.keys(labels)) {
      expect(source, `no default for ${key}`).toMatch(new RegExp(`(^|\\s)${key}:`, "mu"));
    }
  });

  it("defaults to survey mode when no framing is declared", () => {
    expect(source).toContain('deployment.framing?.mode ?? "survey"');
  });

  it("layers the deployment over the defaults rather than replacing them", () => {
    expect(source).toContain("...SURVEY_DEFAULTS");
  });
});

describe("sentenceCase", () => {
  it("capitalises a lowercase label", () => {
    expect(sentenceCase("application")).toBe("Application");
  });

  it("leaves an already-capitalised label alone", () => {
    expect(sentenceCase("PLP application")).toBe("PLP application");
  });

  it("handles an empty string", () => {
    expect(sentenceCase("")).toBe("");
  });
});

describe("the eyebrow never contradicts the status banner", () => {
  it("advertises open applications only when they are open", () => {
    expect(eyebrowFor("open")).toBe(labels.eyebrow);
    expect(labels.eyebrow).toMatch(/open/iu);
  });

  it("names the thing instead of advertising it when the window is shut", () => {
    for (const status of ["closed", "not_yet_open", undefined]) {
      const eyebrow = eyebrowFor(status);
      expect(eyebrow, `status ${status}`).not.toMatch(/\bopen\b/iu);
      expect(eyebrow).toBe("PLP club application");
    }
  });
});

describe("the confirmation screen does not welcome an applicant in", () => {
  it("replaces the form's own confirmation message in application mode", () => {
    // The source message reads "Welcome to PLP. Lead with peace..." — written
    // for students already on the programme, not for someone awaiting a
    // decision. It stays in the source, unshown.
    expect(surveySource.confirmation_message).toMatch(/Welcome to PLP/u);
    expect(labels.confirmation).not.toMatch(/welcome/iu);
    expect(labels.confirmation).not.toBe(surveySource.confirmation_message);
  });

  it("says to wait, and by when an answer comes", () => {
    expect(labels.confirmation).toMatch(/wait for further response/iu);
    expect(labels.confirmation).toMatch(/7 January 2027/u);
  });

  it("does not call it a survey anywhere on the screen", () => {
    for (const text of [labels.successTitle, labels.confirmation, labels.successBody]) {
      expect(text).not.toMatch(/\bsurvey\b/iu);
    }
  });

  it("does not call it a survey to screen readers either", () => {
    // The seal's sr-only text is the one place this was missed.
    const seal = readFileSync(join(srcDir, "components", "survey", "success-seal.tsx"), "utf8");
    expect(seal).not.toContain("Survey submitted successfully");
    expect(seal).toMatch(/survey\/framing"/u);
  });

  it("falls back to the form's own message with no framing", () => {
    // The default is the source message itself, so clearing `framing` restores
    // the original confirmation with no code change.
    const source = readFileSync(join(srcDir, "lib", "survey", "framing.ts"), "utf8");
    expect(source).toContain("confirmation: surveySource.confirmation_message,");
  });
});
