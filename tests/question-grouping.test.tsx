/**
 * Questions in the admin manager are grouped by how they are answered.
 */
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QuestionManager } from "@/components/admin/question-manager";
import type { ManagedQuestion } from "@/lib/admin/queries";

const noop = async () => ({ ok: true as const, message: "" });
const actions = { add: noop, edit: noop, remove: noop };

function q(partial: Partial<ManagedQuestion> & { entryId: number }): ManagedQuestion {
  return {
    orderIndex: partial.entryId,
    title: `Question ${partial.entryId}`,
    description: null,
    type: "paragraph",
    options: null,
    isRequired: true,
    isCustom: false,
    answerCount: 0,
    canRemove: false,
    ...partial,
  };
}

const seeded: ManagedQuestion[] = [
  q({ entryId: 1, type: "short_answer", title: "Full Name" }),
  q({ entryId: 2, type: "dropdown", title: "School Name", options: ["A", "B", "C"] }),
  q({ entryId: 3, type: "multiple_choice", title: "Year Level", options: ["Grade 7", "Grade 8"] }),
  q({ entryId: 4, type: "multiple_choice", title: "I see myself as a leader.", options: ["1", "2"] }),
  q({ entryId: 5, type: "paragraph", title: "What does it mean to be a leader?" }),
];

function renderManager(questions: ManagedQuestion[]) {
  return render(
    <QuestionManager
      surveyId="11111111-1111-1111-1111-111111111111"
      questions={questions}
      canManage
      actions={actions}
    />,
  );
}

describe("grouping by answer kind", () => {
  it("shows both groups with their counts", () => {
    renderManager(seeded);

    // 3 choice-style (dropdown + two multiple choice), 2 written.
    const choice = screen.getByText("Choose an answer").closest("div")!;
    const written = screen.getByText("Written answer").closest("div")!;

    expect(within(choice).getByText("3")).toBeInTheDocument();
    expect(within(written).getByText("2")).toBeInTheDocument();
  });

  it("counts a dropdown as a choice, not as written", () => {
    renderManager(seeded);
    const choice = screen.getByText("Choose an answer").closest("div")!;
    expect(within(choice).getByText("3")).toBeInTheDocument();
  });

  it("renders every question exactly once across the groups", () => {
    renderManager(seeded);
    for (const question of seeded) {
      expect(screen.getAllByText(question.title)).toHaveLength(1);
    }
  });

  it("omits a group that has no questions", () => {
    renderManager([q({ entryId: 1, type: "paragraph" })]);
    expect(screen.queryByText("Choose an answer")).not.toBeInTheDocument();
    expect(screen.getByText("Written answer")).toBeInTheDocument();
  });
});

describe("seeded questions stay read-only", () => {
  it("renders no edit or remove control for them", () => {
    renderManager(seeded);
    expect(screen.queryByRole("button", { name: /remove/iu })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^edit$/iu })).not.toBeInTheDocument();
  });

  it("marks the panel as verified and locked", () => {
    renderManager(seeded);
    expect(screen.getByText(/Verified · locked/u)).toBeInTheDocument();
  });
});

describe("admin-added questions are grouped too", () => {
  const added: ManagedQuestion[] = [
    q({
      entryId: 90,
      type: "multiple_choice",
      title: "Can you attend Saturday sessions?",
      options: ["Yes", "No"],
      isCustom: true,
      canRemove: true,
    }),
    q({
      entryId: 91,
      type: "paragraph",
      title: "Why do you want to join?",
      isCustom: true,
      canRemove: true,
    }),
  ];

  it("splits added questions by kind as well", () => {
    renderManager([...seeded, ...added]);
    // Each group heading now appears twice: once per panel.
    expect(screen.getAllByText("Choose an answer")).toHaveLength(2);
    expect(screen.getAllByText("Written answer")).toHaveLength(2);
  });

  it("offers edit and remove on an unanswered added question", () => {
    renderManager([...seeded, ...added]);
    expect(screen.getAllByRole("button", { name: /^edit$/iu })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /^remove$/iu })).toHaveLength(2);
  });

  it("locks an added question once it has answers", () => {
    renderManager([
      ...seeded,
      q({
        entryId: 92,
        type: "paragraph",
        title: "Already answered",
        isCustom: true,
        answerCount: 3,
        canRemove: false,
      }),
    ]);
    expect(screen.getByText(/Answered — locked/u)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^remove$/iu })).not.toBeInTheDocument();
  });
});

describe("when the deployment withholds the PLP form's questions", () => {
  const added: ManagedQuestion[] = [
    q({
      entryId: 1,
      type: "paragraph",
      title: "Full name, preferred name, and class:",
      isCustom: true,
      canRemove: true,
    }),
    q({
      entryId: 2,
      type: "multiple_choice",
      title: "2. How would you describe your personality?",
      options: ["Introverted", "Extroverted", "Ambivert (a mixture of both)"],
      isCustom: true,
      canRemove: true,
    }),
  ];

  function renderWithheld(questions: ManagedQuestion[]) {
    return render(
      <QuestionManager
        surveyId="11111111-1111-1111-1111-111111111111"
        questions={questions}
        canManage
        withheldCount={28}
        actions={actions}
      />,
    );
  }

  it("does not render an empty 'Verified · locked' panel", () => {
    // An empty locked panel reads as something being broken.
    renderWithheld(added);
    expect(screen.queryByText(/Verified · locked/u)).not.toBeInTheDocument();
  });

  it("presents the admin's questions as the application itself", () => {
    renderWithheld(added);
    expect(screen.getByText("Application questions")).toBeInTheDocument();
  });

  it("says where the PLP form's questions went, rather than leaving a gap", () => {
    renderWithheld(added);
    expect(screen.getByText(/28 baseline questions are not asked here/u)).toBeInTheDocument();
    expect(screen.getByText(/kept, not deleted/u)).toBeInTheDocument();
  });

  it("still groups the admin's questions by how they are answered", () => {
    renderWithheld(added);
    expect(screen.getByText("Choose an answer")).toBeInTheDocument();
    expect(screen.getByText("Written answer")).toBeInTheDocument();
  });

  it("invites the first question when there are none at all", () => {
    renderWithheld([]);
    expect(screen.getByText(/no questions yet/u)).toBeInTheDocument();
  });
});
