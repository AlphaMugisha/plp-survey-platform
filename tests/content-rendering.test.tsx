/**
 * Layer 4 of content verification: the content is checked in the ACTUAL
 * rendered DOM, not just in the data model.
 *
 * Every question is mounted and its exact wording, help text and every answer
 * option are asserted to be present on screen.
 */
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { QuestionField } from "@/components/survey/question-field";
import { ScaleKey } from "@/components/survey/scale-key";
import { SchoolCombobox } from "@/components/survey/school-combobox";
import { ReviewPanel } from "@/components/survey/review-panel";
import {
  allQuestions,
  isScaleLegend,
  schools,
  scaleOptions,
  surveySections,
  type Question,
} from "@/lib/survey/source";
import type { SurveyFormValues } from "@/lib/survey/schema";

/** Mounts one question exactly as the survey page does. */
function QuestionHarness({ question }: { question: Question }) {
  const form = useForm<SurveyFormValues>({
    defaultValues: { [question.fieldKey]: "" },
  });
  return (
    <QuestionField
      question={question}
      control={form.control}
      errors={form.formState.errors}
      index={1}
    />
  );
}

describe("rendered question content", () => {
  it.each(allQuestions.map((q) => [q.title, q] as const))(
    "renders %s with its exact wording",
    (title, question) => {
      render(<QuestionHarness question={question} />);
      // Exact string match — no normalising, no paraphrase.
      expect(screen.getByText(title)).toBeInTheDocument();
    },
  );

  it("renders every question's help text verbatim when the source has one", () => {
    for (const question of allQuestions) {
      if (!question.description) continue;
      const { unmount } = render(<QuestionHarness question={question} />);

      // Compared via textContent rather than a text query, because the scale
      // legend contains deliberate double spaces around each "|" that
      // Testing Library's default normaliser would collapse. The element uses
      // `whitespace-pre-line`, so those spaces really are preserved on screen.
      const help = document.getElementById(`${question.fieldKey}__desc`);
      expect(help).not.toBeNull();
      expect(help!.textContent).toBe(question.description);

      unmount();
    }
  });

  it("renders all five original option strings for every rating question", () => {
    const rating = allQuestions.filter(
      (q) => q.type === "multiple_choice" && q.options?.length === 5,
    );
    expect(rating).toHaveLength(21);

    for (const question of rating) {
      const { unmount } = render(<QuestionHarness question={question} />);
      for (const option of question.options!) {
        // The complete original string must be on screen, not an abbreviation.
        expect(screen.getByText(option)).toBeInTheDocument();
      }
      unmount();
    }
  });

  it("submits the exact original option string as the radio value", () => {
    const question = allQuestions.find((q) => q.options?.length === 5)!;
    render(<QuestionHarness question={question} />);

    for (const option of question.options!) {
      const radio = screen.getByRole("radio", { name: option });
      expect(radio).toHaveAttribute("value", option);
    }
  });

  it("renders the Year Level options exactly", () => {
    const yearLevel = allQuestions.find((q) => q.title === "Year Level")!;
    render(<QuestionHarness question={yearLevel} />);
    for (const option of ["S1", "S2", "S3", "S4", "S5", "S6"]) {
      expect(screen.getByRole("radio", { name: option })).toBeInTheDocument();
    }
  });

  it("marks required questions and leaves the optional one unmarked", () => {
    const required = allQuestions.find((q) => q.required)!;
    const { unmount } = render(<QuestionHarness question={required} />);
    expect(screen.getByLabelText("required")).toBeInTheDocument();
    unmount();

    const optional = allQuestions.find((q) => !q.required)!;
    render(<QuestionHarness question={optional} />);
    expect(screen.queryByLabelText("required")).not.toBeInTheDocument();
    // "(Optional)" survives inside the original wording
    expect(screen.getByText(optional.title)).toHaveTextContent("(Optional)");
  });

  it("renders paragraph questions as multiline textareas", () => {
    for (const question of allQuestions.filter((q) => q.type === "paragraph")) {
      const { unmount } = render(<QuestionHarness question={question} />);
      const field = screen.getByLabelText(question.title, { exact: false });
      expect(field.tagName).toBe("TEXTAREA");
      unmount();
    }
  });
});

describe("rendered school list", () => {
  function ComboHarness() {
    const form = useForm<SurveyFormValues>({ defaultValues: { school: "" } });
    return (
      <SchoolCombobox
        id="school"
        options={schools}
        value={form.watch("school")}
        onChange={(v) => form.setValue("school", v)}
      />
    );
  }

  it("renders all 180 schools, verbatim, once opened", async () => {
    const user = userEvent.setup();
    render(<ComboHarness />);

    await user.click(screen.getByRole("button"));

    const listbox = await screen.findByRole("listbox", { name: "Schools" });
    const options = within(listbox).getAllByRole("option");

    expect(options).toHaveLength(180);
    // Exact names, in the original order.
    expect(options.map((o) => o.textContent?.trim())).toEqual(schools);
  });

  it("reports the real count rather than a truncated list", async () => {
    const user = userEvent.setup();
    render(<ComboHarness />);
    await user.click(screen.getByRole("button"));
    expect(screen.getByText("180 of 180 schools")).toBeInTheDocument();
  });
});

describe("rendered review screen", () => {
  it("shows the full original option string, not a number", () => {
    const question = allQuestions.find((q) => q.options?.length === 5)!;
    const chosen = scaleOptions[2]!;

    const values: SurveyFormValues = {
      email: "student@example.org",
      [question.fieldKey]: chosen,
    };

    render(
      <ReviewPanel values={values} onEditStep={() => {}} missingFields={new Set()} />,
    );

    expect(screen.getByText(chosen)).toBeInTheDocument();
    expect(screen.getByText("student@example.org")).toBeInTheDocument();
  });

  it("lists every section with its exact original title", () => {
    render(<ReviewPanel values={{}} onEditStep={() => {}} missingFields={new Set()} />);
    for (const section of surveySections) {
      expect(screen.getByText(section.title)).toBeInTheDocument();
    }
  });

  it("flags missing required answers instead of silently accepting them", () => {
    const question = allQuestions.find((q) => q.required)!;
    render(
      <ReviewPanel
        values={{}}
        onEditStep={() => {}}
        missingFields={new Set([question.fieldKey])}
      />,
    );
    expect(screen.getByText(/1 required answer is still missing/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Required — not answered/i).length).toBeGreaterThan(0);
  });
});

describe("the repeated scale legend is shown once, not 21 times", () => {
  /** Mounts a question the way a section step does: with a shared scale key. */
  function SharedLegendHarness({ question }: { question: Question }) {
    const form = useForm<SurveyFormValues>({ defaultValues: { [question.fieldKey]: "" } });
    return (
      <>
        <ScaleKey legend={question.description ?? ""} id="section-scale-key" />
        <QuestionField
          question={question}
          control={form.control}
          errors={form.formState.errors}
          scaleLegendId="section-scale-key"
        />
      </>
    );
  }

  const ratingQuestion = allQuestions.find(
    (q) => q.options?.length === 5 && q.description && isScaleLegend(q.description),
  )!;

  it("does not repeat the legend under the question", () => {
    render(<SharedLegendHarness question={ratingQuestion} />);
    // The question's own help paragraph is not rendered a second time.
    expect(document.getElementById(`${ratingQuestion.fieldKey}__desc`)).toBeNull();
  });

  it("still announces the scale to screen readers, per question", () => {
    render(<SharedLegendHarness question={ratingQuestion} />);
    const group = screen.getByRole("radiogroup");
    expect(group).toHaveAttribute("aria-describedby", expect.stringContaining("section-scale-key"));
  });

  it("keeps every word of the legend on the page", () => {
    render(<ScaleKey legend={ratingQuestion.description!} id="k" />);
    const key = document.getElementById("k")!;
    // Each "n = wording" point survives verbatim somewhere in the key.
    for (const point of ratingQuestion.description!.split("|").map((p) => p.trim())) {
      expect(key.textContent).toContain(point);
    }
  });

  it("falls back to plain text if the legend is not in the expected shape", () => {
    render(<ScaleKey legend="Just a sentence with no separators." id="k2" />);
    expect(document.getElementById("k2")!.textContent).toBe(
      "Just a sentence with no separators.",
    );
  });

  it("still renders help text normally when there is no shared key", () => {
    // Questions outside a scale section must keep their own description.
    const { unmount } = render(<QuestionHarness question={ratingQuestion} />);
    expect(document.getElementById(`${ratingQuestion.fieldKey}__desc`)?.textContent).toBe(
      ratingQuestion.description,
    );
    unmount();
  });
});
