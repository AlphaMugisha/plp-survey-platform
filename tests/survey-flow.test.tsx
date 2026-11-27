/**
 * Section navigation, rating selection, answer persistence, the review screen
 * and submission — exercised through the real rendered form.
 */
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SurveyForm } from "@/components/survey/survey-form";
import {
  participantQuestions,
  nameQuestion,
  schoolQuestion,
  yearLevelQuestion,
} from "@/lib/survey/source";
import { stepsForQuestions } from "@/lib/survey/steps";
import { labels } from "@/lib/survey/framing";

const applicationSteps = stepsForQuestions(participantQuestions);

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
  await user.type(screen.getByLabelText(/Which country are you from/u), "Rwanda");

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
  it("shows no questions until an admin adds them", () => {
    render(<SurveyForm />);
    expect(screen.getByLabelText(/^Email/u)).toBeInTheDocument();
    expect(screen.getByLabelText(/Which country are you from/u)).toBeInTheDocument();
    expect(screen.queryByLabelText(nameQuestion.title)).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: YEAR })).not.toBeInTheDocument();
  });

  it("starts on the details step, followed by review", () => {
    render(<SurveyForm questions={participantQuestions} />);
    expect(screen.getByText(`Step 1 of ${applicationSteps.length}`)).toBeInTheDocument();
    expect(screen.getByText("Your details")).toBeInTheDocument();
  });

  it("starts the progress indicator from whatever is pre-filled", () => {
    render(<SurveyForm questions={participantQuestions} />);
    const bar = screen.getByRole("progressbar", { name: /Overall completion/u });
    // A single-school deployment answers the school question in advance, so
    // the bar legitimately starts just above zero.
    const shown = Number(bar.getAttribute("aria-valuenow"));
    if (SINGLE_SCHOOL) {
      expect(shown).toBeGreaterThan(0);
      expect(shown).toBeLessThan(100);
    } else {
      expect(shown).toBe(0);
    }
  });

  it("disables Previous on the first step", () => {
    render(<SurveyForm questions={participantQuestions} />);
    expect(screen.getByRole("button", { name: /Previous/u })).toBeDisabled();
  });

  it("renders the required email field from the form's email-collection setting", () => {
    render(<SurveyForm questions={participantQuestions} />);
    expect(screen.getByLabelText(/^Email/u)).toBeInTheDocument();
  });
});

describe("required-field validation blocks navigation", () => {
  it("refuses to advance while the details step is empty", async () => {
    const user = userEvent.setup();
    render(<SurveyForm questions={participantQuestions} />);

    await clickContinue(user);

    // Still on step 1, with errors surfaced.
    expect(screen.getByText(`Step 1 of ${applicationSteps.length}`)).toBeInTheDocument();
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
    render(<SurveyForm questions={participantQuestions} />);

    await fillDetails(user);
    await clickContinue(user);

    await waitFor(() => {
      expect(screen.getByText(`Step 2 of ${applicationSteps.length}`)).toBeInTheDocument();
    });
    expect(screen.getByText(labels.reviewTitle)).toBeInTheDocument();
  });

  it("does not show the old survey questions", async () => {
    const user = userEvent.setup();
    render(<SurveyForm questions={participantQuestions} />);

    await fillDetails(user);
    await clickContinue(user);
    await waitFor(() => screen.getByText(`Step 2 of ${applicationSteps.length}`));
    expect(screen.queryByText("SECTION A1 — Leadership Identity & Confidence")).not.toBeInTheDocument();
  });
});

describe("rating selection", () => {
  it("records the selected year level", async () => {
    const user = userEvent.setup();
    render(<SurveyForm questions={participantQuestions} />);

    await fillDetails(user);
    const radio = screen.getByRole("radio", { name: YEAR });
    await user.click(radio);

    expect(radio).toBeChecked();
    expect(radio).toHaveAttribute("value", YEAR);
  });

  it("marks only one option per question as selected", async () => {
    const user = userEvent.setup();
    render(<SurveyForm questions={participantQuestions} />);

    await fillDetails(user);
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
    render(<SurveyForm questions={participantQuestions} />);

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
    render(<SurveyForm questions={participantQuestions} />);

    await fillDetails(user);
    await clickContinue(user);
    await waitFor(() => screen.getByText(labels.reviewTitle));

    // Back to the details step…
    await user.click(screen.getByRole("button", { name: /Previous/u }));
    await waitFor(() => screen.getByText(`Step 1 of ${applicationSteps.length}`));
    expect(screen.getByLabelText(/^Email/u)).toHaveValue("student@example.org");
    expect(screen.getByLabelText(nameQuestion.title)).toHaveValue("Alice Uwase");

    // …and forward again: the details are still selected.
    await clickContinue(user);
    await waitFor(() => screen.getByText(labels.reviewTitle));
    await user.click(screen.getByRole("button", { name: /Edit/u }));
    await waitFor(() => expect(screen.getByRole("radio", { name: YEAR })).toBeChecked());
  });

  it("lets a completed step be revisited from the progress rail", async () => {
    const user = userEvent.setup();
    render(<SurveyForm questions={participantQuestions} />);

    await fillDetails(user);
    await clickContinue(user);
    await waitFor(() => screen.getByText(`Step 2 of ${applicationSteps.length}`));

    // The rail button's step number is aria-hidden, so its accessible name is
    // just the step label.
    await user.click(screen.getByRole("button", { name: "You" }));
    await waitFor(() => {
      expect(screen.getByText(`Step 1 of ${applicationSteps.length}`)).toBeInTheDocument();
    });
  });

  it("does not let an unreached step be jumped to", async () => {
    render(<SurveyForm questions={participantQuestions} />);
    // Review has not been reached yet.
    expect(
      within(screen.getByRole("navigation", { name: "Survey progress" })).getByRole("button", {
        name: "Review",
      }),
    ).toBeDisabled();
  });

  it("restores a saved draft after a remount", async () => {
    const user = userEvent.setup();
    const first = render(<SurveyForm questions={participantQuestions} />);

    await fillDetails(user);
    await waitFor(() =>
      expect(window.localStorage.getItem("plp-survey-draft-v1")).toContain(
        "student@example.org",
      ),
    );

    first.unmount();
    render(<SurveyForm questions={participantQuestions} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/^Email/u)).toHaveValue("student@example.org");
    });
    expect(screen.getByText(/restored your saved answers/i)).toBeInTheDocument();
  });
});

describe("review screen and submission", () => {
  /** Walk the application: participant details, then review. */
  async function completeSurvey(user: ReturnType<typeof userEvent.setup>) {
    await fillDetails(user);
    await clickContinue(user);
    await waitFor(() => screen.getByText(labels.reviewTitle));
  }

  it("reaches the review screen with every answer shown exactly", async () => {
    const user = userEvent.setup();
    render(<SurveyForm questions={participantQuestions} />);

    await completeSurvey(user);

    expect(screen.getByText("student@example.org")).toBeInTheDocument();
    expect(screen.getByText("Alice Uwase")).toBeInTheDocument();
    expect(screen.getByText(SCHOOL)).toBeInTheDocument();
    expect(screen.getByText(YEAR)).toBeInTheDocument();
  });

  it("enables submit only when nothing required is missing", async () => {
    const user = userEvent.setup();
    render(<SurveyForm questions={participantQuestions} />);

    await completeSurvey(user);

    const submit = screen.getByRole("button", { name: labels.submit });
    expect(submit).toBeEnabled();
  });

  it("posts the answers keyed by original entry id", async () => {
    const user = userEvent.setup();
    render(<SurveyForm questions={participantQuestions} />);

    await completeSurvey(user);
    await user.click(screen.getByRole("button", { name: labels.submit }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());

    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe("/api/survey/submit");

    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.email).toBe("student@example.org");
    expect(body.surveySlug).toBe("plp-survey-1-baseline-term-1");

    // The required participant details are keyed by their entry ids.
    const requiredIds = participantQuestions.filter((q) => q.required).map((q) => String(q.entry_id));
    for (const id of requiredIds) {
      expect(body.answers[id]).toBeTruthy();
    }

    // The participant detail choices remain the exact option strings.
    expect(body.answers[String(yearLevelQuestion.entry_id)]).toBe(YEAR);

    // And the school is the exact original name.
    expect(body.answers[String(schoolQuestion.entry_id)]).toBe(SCHOOL);
  });

  it("clears the saved draft once the submission is accepted", async () => {
    const user = userEvent.setup();
    render(<SurveyForm questions={participantQuestions} />);

    await completeSurvey(user);
    await user.click(screen.getByRole("button", { name: labels.submit }));

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
    render(<SurveyForm questions={participantQuestions} />);

    await completeSurvey(user);
    await user.click(screen.getByRole("button", { name: labels.submit }));

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
    render(<SurveyForm questions={participantQuestions} />);

    await completeSurvey(user);
    await user.click(screen.getByRole("button", { name: labels.submit }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/could not reach the server/i);
    });
  });
});
