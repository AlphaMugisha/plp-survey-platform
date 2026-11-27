/**
 * "Other: __________" — the fill-in option.
 *
 * PLP's questionnaire offers it on five questions. The option is stored exactly
 * as written, and the run of underscores is a blank the applicant types into.
 * A chosen fill-in answer is stored as the option with the blank filled:
 * "Other: Debate club".
 *
 * These cover the rule, the validation on both sides, and the rendered control.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { useForm } from "react-hook-form";
import {
  composeFillIn,
  fillInIssue,
  fillInOption,
  fillInPrefix,
  isAcceptableChoice,
  splitFillIn,
  MAX_FILL_IN,
} from "@/lib/survey/fill-in-option";
import { schemaForQuestion, validateSubmissionAnswers } from "@/lib/survey/schema";
import { fieldKeyFor, type Question } from "@/lib/survey/source";
import { RatingOptionGroup } from "@/components/survey/rating-option-group";
import { QuestionField } from "@/components/survey/question-field";
import type { SurveyFormValues } from "@/lib/survey/schema";

const OTHER = "Other: __________";

function choiceQuestion(options: string[], required = true): Question {
  return {
    index: 2,
    entry_id: 2,
    type: "multiple_choice",
    title: "How would you describe your personality?",
    description: null,
    required,
    options,
    fieldKey: fieldKeyFor(2),
  };
}

const personality = choiceQuestion([
  "Introverted",
  "Extroverted",
  "Ambivert (a mixture of both)",
  OTHER,
]);

const plain = choiceQuestion(["Yes", "No"]);

/* ------------------------------------------------------------------ *
 * The rule
 * ------------------------------------------------------------------ */

describe("recognising a blank", () => {
  it("reads the lead-in text off an option that ends in a blank", () => {
    expect(fillInPrefix(OTHER)).toBe("Other: ");
  });

  it("treats an ordinary option as having no blank", () => {
    expect(fillInPrefix("Introverted")).toBeNull();
    expect(fillInPrefix("Ambivert (a mixture of both)")).toBeNull();
  });

  it("ignores a bare run of underscores with nothing to echo back", () => {
    expect(fillInPrefix("__________")).toBeNull();
  });

  it("finds the one fill-in option on a question", () => {
    expect(fillInOption(personality)).toBe(OTHER);
    expect(fillInOption(plain)).toBeNull();
  });

  it("works for any option ending in a blank, not just 'Other'", () => {
    // So a question an admin writes later behaves the same with no code change.
    expect(fillInPrefix("Something else: ______")).toBe("Something else: ");
  });
});

describe("splitting a stored answer", () => {
  it("separates the lead-in from what was typed", () => {
    expect(splitFillIn(personality, "Other: Debate club")).toEqual({
      option: OTHER,
      prefix: "Other: ",
      text: "Debate club",
    });
  });

  it("treats the untouched option as chosen but unanswered", () => {
    expect(splitFillIn(personality, OTHER)?.text).toBe("");
  });

  it("returns null for an ordinary option", () => {
    expect(splitFillIn(personality, "Introverted")).toBeNull();
  });

  it("composes the stored value from the blank", () => {
    expect(composeFillIn("Other: ", "Debate club")).toBe("Other: Debate club");
  });
});

/* ------------------------------------------------------------------ *
 * What counts as an answer
 * ------------------------------------------------------------------ */

describe("accepting an answer", () => {
  it("accepts each of the question's own options unchanged", () => {
    for (const option of personality.options!) {
      if (option === OTHER) continue;
      expect(isAcceptableChoice(personality, option)).toBe(true);
    }
  });

  it("accepts the fill-in option with something written in it", () => {
    expect(isAcceptableChoice(personality, "Other: Debate club")).toBe(true);
  });

  it("rejects the fill-in option with nothing written in it", () => {
    expect(isAcceptableChoice(personality, OTHER)).toBe(false);
    expect(isAcceptableChoice(personality, "Other: ")).toBe(false);
    expect(isAcceptableChoice(personality, "Other:    ")).toBe(false);
  });

  it("rejects a paraphrase of a real option", () => {
    expect(isAcceptableChoice(personality, "introvert")).toBe(false);
    expect(isAcceptableChoice(personality, "Introverted ")).toBe(false);
  });

  it("rejects free text that does not use the question's own lead-in", () => {
    expect(isAcceptableChoice(personality, "Debate club")).toBe(false);
  });

  it("rejects an answer that would not fit in the column", () => {
    expect(isAcceptableChoice(personality, `Other: ${"x".repeat(MAX_FILL_IN + 1)}`)).toBe(false);
    expect(isAcceptableChoice(personality, `Other: ${"x".repeat(MAX_FILL_IN)}`)).toBe(true);
  });

  it("does not let a question without a blank accept free text", () => {
    expect(isAcceptableChoice(plain, "Yes")).toBe(true);
    expect(isAcceptableChoice(plain, "Other: anything")).toBe(false);
    expect(isAcceptableChoice(plain, "Maybe")).toBe(false);
  });

  it("explains an empty blank rather than saying 'choose an option'", () => {
    expect(fillInIssue(personality, "Other: ")).toMatch(/say what "Other:" means for you/u);
    expect(fillInIssue(personality, "Other: Debate club")).toBeNull();
    expect(fillInIssue(personality, "Introverted")).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * Validation, client and server
 * ------------------------------------------------------------------ */

describe("client-side validation", () => {
  const schema = schemaForQuestion(personality);

  it("passes a filled-in answer", () => {
    expect(schema.safeParse("Other: Debate club").success).toBe(true);
  });

  it("fails a chosen-but-empty blank, with a message about the blank", () => {
    const result = schema.safeParse("Other: ");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.message).toMatch(/say what "Other:" means for you/u);
    }
  });

  it("still rejects a value that is not an option at all", () => {
    const result = schema.safeParse("Something I made up");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.message).toMatch(/choose one of the options/iu);
    }
  });
});

describe("server-side validation", () => {
  const questions = [personality];

  it("accepts a filled-in answer", () => {
    const answers = { [String(personality.entry_id)]: "Other: Debate club" };
    expect(validateSubmissionAnswers(answers, questions)).toEqual([]);
  });

  it("refuses a chosen-but-empty blank", () => {
    const answers = { [String(personality.entry_id)]: "Other: " };
    const issues = validateSubmissionAnswers(answers, questions);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toMatch(/say what "Other:" means for you/u);
  });

  it("refuses free text smuggled in without the lead-in", () => {
    const answers = { [String(personality.entry_id)]: "Debate club" };
    const issues = validateSubmissionAnswers(answers, questions);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toMatch(/not one of the allowed options/iu);
  });

  it("still accepts an ordinary option", () => {
    const answers = { [String(personality.entry_id)]: "Introverted" };
    expect(validateSubmissionAnswers(answers, questions)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * The rendered control
 * ------------------------------------------------------------------ */

function GroupHarness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = React.useState(initial);
  return (
    <>
      <RatingOptionGroup
        name="q_2"
        options={personality.options!}
        value={value}
        onChange={setValue}
      />
      <output data-testid="stored">{value}</output>
    </>
  );
}

describe("the rendered option", () => {
  it("shows the option verbatim, blank and all, until it is chosen", () => {
    render(<GroupHarness />);
    expect(screen.getByText(OTHER)).toBeInTheDocument();
  });

  it("reveals an input once chosen, and drops the underscores", async () => {
    const user = userEvent.setup();
    render(<GroupHarness />);

    expect(screen.queryByPlaceholderText("Please specify…")).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: OTHER }));

    expect(screen.getByPlaceholderText("Please specify…")).toBeInTheDocument();
    expect(screen.queryByText(OTHER)).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Other:" })).toBeInTheDocument();
  });

  it("stores the lead-in with the typed text appended", async () => {
    const user = userEvent.setup();
    render(<GroupHarness />);

    await user.click(screen.getByRole("radio", { name: OTHER }));
    await user.type(screen.getByPlaceholderText("Please specify…"), "Debate club");

    expect(screen.getByTestId("stored")).toHaveTextContent("Other: Debate club");
  });

  it("keeps the option selected while the applicant types", async () => {
    const user = userEvent.setup();
    render(<GroupHarness />);

    const radio = screen.getByRole("radio", { name: OTHER });
    await user.click(radio);
    await user.type(screen.getByPlaceholderText("Please specify…"), "Debate");

    expect(screen.getByRole("radio", { name: "Other:" })).toBeChecked();
  });

  it("shows a stored answer back when the form is restored from a draft", () => {
    render(<GroupHarness initial="Other: Debate club" />);
    expect(screen.getByPlaceholderText("Please specify…")).toHaveValue("Debate club");
    expect(screen.getByRole("radio", { name: "Other:" })).toBeChecked();
  });

  it("drops the input again when another option is picked", async () => {
    const user = userEvent.setup();
    render(<GroupHarness initial="Other: Debate club" />);

    await user.click(screen.getByRole("radio", { name: "Introverted" }));

    expect(screen.queryByPlaceholderText("Please specify…")).not.toBeInTheDocument();
    expect(screen.getByTestId("stored")).toHaveTextContent("Introverted");
  });

  it("does not add an input to a question with no blank", async () => {
    const user = userEvent.setup();
    function Plain() {
      const [value, setValue] = React.useState("");
      return (
        <RatingOptionGroup name="q_4" options={plain.options!} value={value} onChange={setValue} />
      );
    }
    render(<Plain />);
    await user.click(screen.getByRole("radio", { name: "Yes" }));
    expect(screen.queryByPlaceholderText("Please specify…")).not.toBeInTheDocument();
  });

  it("labels the input for screen readers", async () => {
    const user = userEvent.setup();
    render(<GroupHarness />);
    await user.click(screen.getByRole("radio", { name: OTHER }));
    expect(screen.getByLabelText("Other: please specify")).toBeInTheDocument();
  });
});

describe("inside a real question field", () => {
  function FieldHarness() {
    const form = useForm<SurveyFormValues>({
      defaultValues: { [personality.fieldKey]: "" },
    });
    return (
      <QuestionField
        question={personality}
        control={form.control}
        errors={form.formState.errors}
        index={1}
      />
    );
  }

  it("lets an applicant choose Other and say what it is", async () => {
    const user = userEvent.setup();
    render(<FieldHarness />);

    await user.click(screen.getByRole("radio", { name: OTHER }));
    const input = screen.getByPlaceholderText("Please specify…");
    await user.type(input, "Quietly competitive");

    expect(input).toHaveValue("Quietly competitive");
  });
});
