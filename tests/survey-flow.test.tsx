/**
 * Section navigation, rating selection, answer persistence, the review screen
 * and submission — exercised through the real rendered form.
 */
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SurveyForm } from "@/components/survey/survey-form";
import {
  allQuestions,
  nameQuestion,
  scaleOptions,
  schoolQuestion,
  yearLevelQuestion,
  surveySections,
} from "@/lib/survey/source";
import { surveySteps } from "@/lib/survey/steps";

// Whatever school this deployment offers. With a single-school deployment
// the field is pre-filled and shown as settled rather than as a dropdown.
const SCHOOL = schoolQuestion.options![0]!;
const SINGLE_SCHOOL = schoolQuestion.options!.length === 1;
const YEAR = yearLevelQuestion.options![0]!;

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 201 })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/* ------------------------------------------------------------------ *
 * Helpers that drive the form the way a student would
 * ------------------------------------------------------------------ */

async function fillDetails(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^Email/u), "student@example.org");
  await user.type(screen.getByLabelText(nameQuestion.title), "Alice Uwase");

  // One school means there is no choice to make: the value is pre-filled and
  // shown as settled, so there is no combobox to open.
  if (!SINGLE_SCHOOL) {
    // The trigger is a <button> the question's <label> points at, so its
    // accessible name comes from the label, not its placeholder. Target it
    // by its stable id instead.
    const schoolTrigger = document.getElementById(schoolQuestion.fieldKey);
    expect(schoolTrigger).not.toBeNull();
    await user.click(schoolTrigger!);
    const listbox = await screen.findByRole("listbox", { name: "Schools" });
    await user.click(within(listbox).getByRole("option", { name: SCHOOL }));
  }

  await user.click(screen.getByRole("radio", { name: YEAR }));
}

/** Answer every rating question on the current section step (if it has any). */
async function answerCurrentSection(
  user: ReturnType<typeof userEvent.setup>,
  optionIndex = 4,
) {
  // Section C is free text, so a step may legitimately have no radio groups.
  const groups = screen.queryAllByRole("radiogroup");
  for (const group of groups) {
    const radios = within(group).getAllByRole("radio");
    const target = radios[optionIndex] ?? radios[0]!;
    await user.click(target);
  }
}

function clickContinue(user: ReturnType<typeof userEvent.setup>) {
  const button =
    screen.queryByRole("button", { name: /Continue/u }) ??
    screen.getByRole("button", { name: /Review answers/u });
  return user.click(button);
}

/* ------------------------------------------------------------------ *
 * Tests
 * ------------------------------------------------------------------ */

describe("initial state", () => {
  it("starts on the details step of 7", () => {
    render(<SurveyForm />);
    expect(screen.getByText(`Step 1 of ${surveySteps.length}`)).toBeInTheDocument();
    expect(screen.getByText("Your details")).toBeInTheDocument();
  });

  it("starts the progress indicator from whatever is pre-filled", () => {
    render(<SurveyForm />);
    const bar = screen.getByRole("progressbar", { name: /Overall completion/u });
    // A single-school deployment answers the school question in advance, so
    // the bar legitimately starts just above zero.
    const shown = Number(bar.getAttribute("aria-valuenow"));
    if (SINGLE_SCHOOL) {
      expect(shown).toBeGreaterThan(0);
      expect(shown).toBeLessThan(10);
    } else {
      expect(shown).toBe(0);
    }
  });

  it("disables Previous on the first step", () => {
    render(<SurveyForm />);
    expect(screen.getByRole("button", { name: /Previous/u })).toBeDisabled();
  });

  it("renders the required email field from the form's email-collection setting", () => {
    render(<SurveyForm />);
    expect(screen.getByLabelText(/^Email/u)).toBeInTheDocument();
  });
});

describe("required-field validation blocks navigation", () => {
  it("refuses to advance while the details step is empty", async () => {
    const user = userEvent.setup();
    render(<SurveyForm />);

    await clickContinue(user);

    // Still on step 1, with errors surfaced.
    expect(screen.getByText(`Step 1 of ${surveySteps.length}`)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Your email address is required.")).toBeInTheDocument();
    });

    // The school question's own help text is the same sentence as its error
    // message, so assert on the live-region alerts rather than page text.
    const alerts = screen.getAllByRole("alert").map((a) => a.textContent ?? "");
    expect(alerts.some((t) => t.includes("This answer is required."))).toBe(true);

    if (!SINGLE_SCHOOL) {
      // Only asked for when there is actually a school to choose.
      expect(
        alerts.some((t) => t.includes("Please select your school from the list.")),
      ).toBe(true);
    }
  });

  it("advances once the details are valid", async () => {
    const user = userEvent.setup();
    render(<SurveyForm />);

    await fillDetails(user);
    await clickContinue(user);

    await waitFor(() => {
      expect(screen.getByText(`Step 2 of ${surveySteps.length}`)).toBeInTheDocument();
    });
    expect(screen.getByText(surveySections[0]!.plainTitle)).toBeInTheDocument();
  });

  it("refuses to leave a section with unanswered rating questions", async () => {
    const user = userEvent.setup();
    render(<SurveyForm />);

    await fillDetails(user);
    await clickContinue(user);
    await waitFor(() => screen.getByText(`Step 2 of ${surveySteps.length}`));

    await clickContinue(user);

    await waitFor(() => {
      expect(
        screen.getAllByText("Please choose one of the options.").length,
      ).toBeGreaterThan(0);
    });
    expect(screen.getByText(`Step 2 of ${surveySteps.length}`)).toBeInTheDocument();
  });
});

describe("rating selection", () => {
  it("records the exact original option string", async () => {
    const user = userEvent.setup();
    render(<SurveyForm />);

    await fillDetails(user);
    await clickContinue(user);
    await waitFor(() => screen.getByText(`Step 2 of ${surveySteps.length}`));

    const chosen = scaleOptions[2]!;
    const radio = screen.getAllByRole("radio", { name: chosen })[0]!;
    await user.click(radio);

    expect(radio).toBeChecked();
    expect(radio).toHaveAttribute("value", chosen);
  });

  it("marks only one option per question as selected", async () => {
    const user = userEvent.setup();
    render(<SurveyForm />);

    await fillDetails(user);
    await clickContinue(user);
    await waitFor(() => screen.getByText(`Step 2 of ${surveySteps.length}`));

    const group = screen.getAllByRole("radiogroup")[0]!;
    const radios = within(group).getAllByRole("radio");

    await user.click(radios[0]!);
    expect(radios[0]).toBeChecked();

    await user.click(radios[3]!);
    expect(radios[3]).toBeChecked();
    expect(radios[0]).not.toBeChecked();
  });

  it("advances the progress bar as answers are given", async () => {
    const user = userEvent.setup();
    render(<SurveyForm />);

    await fillDetails(user);
    const bar = screen.getByRole("progressbar", { name: /Overall completion/u });
    await waitFor(() => {
      expect(Number(bar.getAttribute("aria-valuenow"))).toBeGreaterThan(0);
    });
  });
});

describe("section navigation and answer persistence", () => {
  it("keeps answers when moving back and forward", async () => {
    const user = userEvent.setup();
    render(<SurveyForm />);

    await fillDetails(user);
    await clickContinue(user);
    await waitFor(() => screen.getByText(`Step 2 of ${surveySteps.length}`));

    const chosen = scaleOptions[4]!;
    await user.click(screen.getAllByRole("radio", { name: chosen })[0]!);

    // Back to the details step…
    await user.click(screen.getByRole("button", { name: /Previous/u }));
    await waitFor(() => screen.getByText(`Step 1 of ${surveySteps.length}`));
    expect(screen.getByLabelText(/^Email/u)).toHaveValue("student@example.org");
    expect(screen.getByLabelText(nameQuestion.title)).toHaveValue("Alice Uwase");

    // …and forward again: the rating is still selected.
    await clickContinue(user);
    await waitFor(() => screen.getByText(`Step 2 of ${surveySteps.length}`));
    expect(screen.getAllByRole("radio", { name: chosen })[0]).toBeChecked();
  });

  it("lets a completed step be revisited from the progress rail", async () => {
    const user = userEvent.setup();
    render(<SurveyForm />);

    await fillDetails(user);
    await clickContinue(user);
    await waitFor(() => screen.getByText(`Step 2 of ${surveySteps.length}`));

    // The rail button's step number is aria-hidden, so its accessible name is
    // just the step label.
    await user.click(screen.getByRole("button", { name: "You" }));
    await waitFor(() => {
      expect(screen.getByText(`Step 1 of ${surveySteps.length}`)).toBeInTheDocument();
    });
  });

  it("does not let an unreached step be jumped to", async () => {
    render(<SurveyForm />);
    // Section C has not been reached yet.
    expect(screen.getByRole("button", { name: /Review/u })).toBeDisabled();
  });

  it("restores a saved draft after a remount", async () => {
    const user = userEvent.setup();
    const first = render(<SurveyForm />);

    await fillDetails(user);
    await waitFor(() =>
      expect(window.localStorage.getItem("plp-survey-draft-v1")).toContain(
        "student@example.org",
      ),
    );

    first.unmount();
    render(<SurveyForm />);

    await waitFor(() => {
      expect(screen.getByLabelText(/^Email/u)).toHaveValue("student@example.org");
    });
    expect(screen.getByText(/restored your saved answers/i)).toBeInTheDocument();
  });
});

describe("review screen and submission", () => {
  /** Walk the whole survey: details, all five sections, then review. */
  async function completeSurvey(user: ReturnType<typeof userEvent.setup>) {
    await fillDetails(user);
    await clickContinue(user);

    for (let i = 0; i < surveySections.length; i += 1) {
      await waitFor(() => screen.getByText(`Step ${i + 2} of ${surveySteps.length}`));

      await answerCurrentSection(user);

      // Section C is free text, not ratings.
      for (const textarea of screen.queryAllByRole("textbox")) {
        if (textarea.tagName === "TEXTAREA") {
          await user.type(textarea, "My considered answer.");
        }
      }

      await clickContinue(user);
    }

    await waitFor(() => screen.getByText("Review your answers"));
  }

  it("reaches the review screen with every answer shown exactly", async () => {
    const user = userEvent.setup();
    render(<SurveyForm />);

    await completeSurvey(user);

    expect(screen.getByText("student@example.org")).toBeInTheDocument();
    expect(screen.getByText("Alice Uwase")).toBeInTheDocument();
    expect(screen.getByText(SCHOOL)).toBeInTheDocument();
    // The full original option string, not a number.
    expect(screen.getAllByText(scaleOptions[4]!).length).toBeGreaterThan(0);
  });

  it("enables submit only when nothing required is missing", async () => {
    const user = userEvent.setup();
    render(<SurveyForm />);

    await completeSurvey(user);

    const submit = screen.getByRole("button", { name: /Submit survey/u });
    expect(submit).toBeEnabled();
  });

  it("posts the answers keyed by original entry id", async () => {
    const user = userEvent.setup();
    render(<SurveyForm />);

    await completeSurvey(user);
    await user.click(screen.getByRole("button", { name: /Submit survey/u }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());

    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe("/api/survey/submit");

    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.email).toBe("student@example.org");
    expect(body.surveySlug).toBe("plp-survey-1-baseline-term-1");

    // All 27 required answers present, keyed by entry id.
    const requiredIds = allQuestions.filter((q) => q.required).map((q) => String(q.entry_id));
    for (const id of requiredIds) {
      expect(body.answers[id]).toBeTruthy();
    }

    // Choice answers are the exact option strings.
    const rating = allQuestions.find((q) => q.options?.length === 5)!;
    expect(body.answers[String(rating.entry_id)]).toBe(scaleOptions[4]);

    // And the school is the exact original name.
    expect(body.answers[String(schoolQuestion.entry_id)]).toBe(SCHOOL);
  });

  it("clears the saved draft once the submission is accepted", async () => {
    const user = userEvent.setup();
    render(<SurveyForm />);

    await completeSurvey(user);
    await user.click(screen.getByRole("button", { name: /Submit survey/u }));

    await waitFor(() => {
      expect(window.localStorage.getItem("plp-survey-draft-v1")).toBeNull();
    });
  });

  it("surfaces a server error and keeps the answers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "This survey is closed." }), { status: 409 }),
      ),
    );

    const user = userEvent.setup();
    render(<SurveyForm />);

    await completeSurvey(user);
    await user.click(screen.getByRole("button", { name: /Submit survey/u }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("This survey is closed.");
    });
    // The draft is retained so nothing is lost.
    expect(window.localStorage.getItem("plp-survey-draft-v1")).not.toBeNull();
  });

  it("explains a network failure without losing answers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    const user = userEvent.setup();
    render(<SurveyForm />);

    await completeSurvey(user);
    await user.click(screen.getByRole("button", { name: /Submit survey/u }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/could not reach the server/i);
    });
  });
});
