"use client";

import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  ListChecks,
  Lock,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Panel, EmptyState } from "@/components/admin/ui";
import type { ActionResult } from "@/app/admin/surveys/actions";
import type { ManagedQuestion } from "@/lib/admin/queries";
import { cn } from "@/lib/utils";

type Action = (formData: FormData) => Promise<ActionResult>;

/* ------------------------------------------------------------------ *
 * Grouping
 * ------------------------------------------------------------------ */

/**
 * Questions split by how they are answered, not by their database type.
 *
 * "Choose an answer" covers multiple_choice AND dropdown — the school
 * selector is a dropdown but reads as a choice to anyone looking at the list.
 * "Written answer" covers short_answer and paragraph.
 */
type AnswerKind = "choice" | "written";

function answerKindOf(question: ManagedQuestion): AnswerKind {
  return question.type === "multiple_choice" || question.type === "dropdown"
    ? "choice"
    : "written";
}

const GROUPS: Array<{ kind: AnswerKind; label: string; icon: React.ReactNode }> = [
  {
    kind: "choice",
    label: "Choose an answer",
    icon: <ListChecks className="size-3.5" aria-hidden="true" />,
  },
  {
    kind: "written",
    label: "Written answer",
    icon: <Type className="size-3.5" aria-hidden="true" />,
  },
];

function groupByKind(questions: ManagedQuestion[]) {
  return GROUPS.map((group) => ({
    ...group,
    questions: questions.filter((q) => answerKindOf(q) === group.kind),
  })).filter((group) => group.questions.length > 0);
}

/** Small heading above each group, with its count. */
function GroupHeading({
  icon,
  label,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2.5 pb-1">
      <span
        aria-hidden="true"
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-plp-50 text-plp-600"
      >
        {icon}
      </span>
      <h3 className="text-[0.8125rem] font-semibold uppercase tracking-[0.1em] text-plp-700">
        {label}
      </h3>
      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[0.6875rem] font-medium tabular-nums text-ink-muted">
        {count}
      </span>
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Manage the questions on the live application.
 *
 * Two classes of question, shown separately and never confusable:
 *
 *   Seeded  — extracted and verified from the PLP Google Form. Read-only, with
 *             no edit or remove control rendered at all.
 *   Added   — appended by an administrator. Editable and removable, but only
 *             until somebody answers one.
 *
 * Within each, questions are grouped by how they are answered. The rules are
 * enforced by the server action and, independently, by a database trigger;
 * this UI only reflects them.
 */
export function QuestionManager({
  surveyId,
  questions,
  canManage,
  withheldCount = 0,
  actions,
}: {
  surveyId: string;
  questions: ManagedQuestion[];
  canManage: boolean;
  /**
   * Source questions this deployment does not ask. Reported rather than
   * hidden, so the gap between the official instrument and this application
   * is always visible to whoever is managing it.
   */
  withheldCount?: number;
  actions: { add: Action; edit: Action; remove: Action };
}) {
  const [result, setResult] = React.useState<ActionResult | null>(null);
  const [pending, setPending] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [type, setType] = React.useState<"paragraph" | "multiple_choice">("paragraph");
  const [confirming, setConfirming] = React.useState<number | null>(null);
  const [editing, setEditing] = React.useState<number | null>(null);

  const seeded = questions.filter((q) => !q.isCustom);
  const added = questions.filter((q) => q.isCustom);

  const seededGroups = groupByKind(seeded);
  const addedGroups = groupByKind(added);

  /*
   * What this panel is depends on the deployment.
   *
   * When the PLP form's own questions are all withheld, these ARE the
   * application — so the panel says so, and names the withheld count rather
   * than leaving the reader wondering where the original questions went.
   */
  const applicationQuestionsDescription = (() => {
    const whereabouts =
      withheldCount > 0
        ? ` The PLP form's ${withheldCount} baseline questions are not asked here — they are kept, not deleted, and come back when the deployment asks for them.`
        : "";

    if (added.length === 0) {
      return (
        (seeded.length === 0
          ? "This application has no questions yet. Add the first one and it appears on the form straight away."
          : "Questions added here appear on the application straight away, after the applicant's details.") +
        whereabouts
      );
    }

    const count = `${added.length} question${added.length === 1 ? "" : "s"}`;
    return seeded.length === 0
      ? `${count}, asked in this order.${whereabouts}`
      : `${count}, asked after the applicant's details.${whereabouts}`;
  })();

  async function run(action: Action, formData: FormData) {
    setPending(true);
    setResult(null);
    try {
      const res = await action(formData);
      setResult(res);
      if (res.ok) {
        setAdding(false);
        setConfirming(null);
        setEditing(null);
      }
    } catch (error) {
      setResult({
        ok: false,
        error: error instanceof Error ? error.message : "Something went wrong.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ---- Feedback ---- */}
      {result && (
        <div
          role="status"
          className={cn(
            "flex items-start gap-3 rounded-2xl border p-4 sm:p-5",
            result.ok
              ? "border-success/25 bg-success-soft"
              : "border-destructive/30 bg-destructive-soft",
          )}
        >
          {result.ok ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
          ) : (
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
          )}
          <p
            className={cn(
              "text-[0.9375rem] leading-relaxed",
              result.ok ? "text-plp-800" : "text-destructive",
            )}
          >
            {result.ok ? result.message : result.error}
          </p>
        </div>
      )}

      {/* ================= Questions you added ================= */}
      <Panel
        title={seeded.length === 0 ? "Application questions" : "Questions you added"}
        description={applicationQuestionsDescription}
        bodyClassName={added.length === 0 && !adding ? "p-0" : undefined}
        actions={
          canManage ? (
            adding ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
                <X aria-hidden="true" />
                Cancel
              </Button>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
                <Plus aria-hidden="true" />
                Add question
              </Button>
            )
          ) : undefined
        }
      >
        {added.length === 0 && !adding ? (
          <EmptyState
            icon={<Plus className="size-5" />}
            title="No extra questions yet"
            description="The application currently asks only the questions from the verified PLP form."
            action={
              canManage ? (
                <Button type="button" variant="outline" onClick={() => setAdding(true)}>
                  <Plus aria-hidden="true" />
                  Add your first question
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-6">
            {addedGroups.map((group) => (
              <section key={group.kind}>
                <GroupHeading
                  icon={group.icon}
                  label={group.label}
                  count={group.questions.length}
                />

                <ul className="mt-3 space-y-3">
                  {group.questions.map((question) => (
                    <li
                      key={question.entryId}
                      className="card-quiet rounded-2xl border border-border bg-white p-4 sm:p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant={question.isRequired ? "neutral" : "outline"}
                              size="sm"
                            >
                              {question.isRequired ? "Required" : "Optional"}
                            </Badge>
                            {question.answerCount > 0 && (
                              <Badge variant="success" size="sm">
                                {question.answerCount} answered
                              </Badge>
                            )}
                          </div>

                          <p className="mt-2.5 text-[0.9375rem] font-medium leading-snug text-plp-800">
                            {question.title}
                          </p>
                          {question.description && (
                            <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-muted">
                              {question.description}
                            </p>
                          )}
                          {question.options && question.options.length > 0 && (
                            <ul className="mt-2.5 flex flex-wrap gap-1.5">
                              {question.options.map((option) => (
                                <li
                                  key={option}
                                  className="rounded-lg border border-border bg-paper px-2 py-0.5 text-[0.75rem] text-ink-soft"
                                >
                                  {option}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {canManage && (
                          <div className="shrink-0">
                            {question.canRemove ? (
                              editing === question.entryId ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditing(null)}
                                >
                                  <X aria-hidden="true" />
                                  Cancel
                                </Button>
                              ) : confirming === question.entryId ? (
                                <form
                                  action={(fd) => run(actions.remove, fd)}
                                  className="flex items-center gap-2"
                                >
                                  <input type="hidden" name="surveyId" value={surveyId} />
                                  <input
                                    type="hidden"
                                    name="entryId"
                                    value={question.entryId}
                                  />
                                  <Button
                                    type="submit"
                                    variant="destructive"
                                    size="sm"
                                    disabled={pending}
                                  >
                                    <Trash2 aria-hidden="true" />
                                    Confirm
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setConfirming(null)}
                                  >
                                    Cancel
                                  </Button>
                                </form>
                              ) : (
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={pending}
                                    onClick={() => {
                                      setEditing(question.entryId);
                                      setConfirming(null);
                                    }}
                                  >
                                    <Pencil aria-hidden="true" />
                                    Edit
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={pending}
                                    onClick={() => setConfirming(question.entryId)}
                                  >
                                    <Trash2 aria-hidden="true" />
                                    Remove
                                  </Button>
                                </div>
                              )
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted px-2.5 py-1.5 text-[0.75rem] text-ink-muted">
                                <Lock className="size-3.5" aria-hidden="true" />
                                Answered — locked
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ---- Inline edit ---- */}
                      {editing === question.entryId && canManage && (
                        <form
                          className="mt-4 space-y-4 border-t border-border pt-4"
                          action={(fd) => run(actions.edit, fd)}
                        >
                          <input type="hidden" name="surveyId" value={surveyId} />
                          <input type="hidden" name="entryId" value={question.entryId} />

                          <div className="space-y-2">
                            <Label htmlFor={`edit-title-${question.entryId}`}>Question</Label>
                            <Input
                              id={`edit-title-${question.entryId}`}
                              name="title"
                              required
                              minLength={3}
                              defaultValue={question.title}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`edit-desc-${question.entryId}`}>
                              Help text (optional)
                            </Label>
                            <Input
                              id={`edit-desc-${question.entryId}`}
                              name="description"
                              defaultValue={question.description ?? ""}
                            />
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor={`edit-type-${question.entryId}`}>
                                Answer type
                              </Label>
                              <select
                                id={`edit-type-${question.entryId}`}
                                name="type"
                                defaultValue={
                                  question.type === "multiple_choice"
                                    ? "multiple_choice"
                                    : "paragraph"
                                }
                                className="h-12 w-full appearance-none rounded-xl border border-border bg-surface px-4 text-[0.9375rem] text-ink shadow-subtle focus:border-plp-400 focus:shadow-glow-brand focus:outline-none"
                              >
                                <option value="paragraph">Written answer</option>
                                <option value="multiple_choice">Choose one option</option>
                              </select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`edit-required-${question.entryId}`}>
                                Must be answered?
                              </Label>
                              <select
                                id={`edit-required-${question.entryId}`}
                                name="required"
                                defaultValue={question.isRequired ? "true" : "false"}
                                className="h-12 w-full appearance-none rounded-xl border border-border bg-surface px-4 text-[0.9375rem] text-ink shadow-subtle focus:border-plp-400 focus:shadow-glow-brand focus:outline-none"
                              >
                                <option value="true">Required</option>
                                <option value="false">Optional</option>
                              </select>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`edit-options-${question.entryId}`}>
                              Answer options
                            </Label>
                            <Textarea
                              id={`edit-options-${question.entryId}`}
                              name="options"
                              rows={4}
                              defaultValue={(question.options ?? []).join("\n")}
                              placeholder="One per line. Leave blank for a written answer."
                            />
                            <p className="text-[0.75rem] text-ink-muted">
                              Only used when the answer type is a choice.
                            </p>
                          </div>

                          <Button type="submit" loading={pending}>
                            Save changes
                          </Button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        {/* ---- Add form ---- */}
        {adding && canManage && (
          <form
            className={cn(
              "space-y-4",
              added.length > 0 && "mt-6 border-t border-border pt-5",
            )}
            action={(fd) => run(actions.add, fd)}
          >
            <input type="hidden" name="surveyId" value={surveyId} />

            <div className="space-y-2">
              <Label htmlFor="q-title">Question</Label>
              <Input
                id="q-title"
                name="title"
                required
                minLength={3}
                placeholder="e.g. Why do you want to join the PLP club?"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="q-description">Help text (optional)</Label>
              <Input
                id="q-description"
                name="description"
                placeholder="A short hint shown under the question"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="q-type">Answer type</Label>
                <select
                  id="q-type"
                  name="type"
                  value={type}
                  onChange={(e) => setType(e.target.value as typeof type)}
                  className="h-12 w-full appearance-none rounded-xl border border-border bg-surface px-4 text-[0.9375rem] text-ink shadow-subtle focus:border-plp-400 focus:shadow-glow-brand focus:outline-none"
                >
                  <option value="paragraph">Written answer</option>
                  <option value="multiple_choice">Choose one option</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="q-required">Must be answered?</Label>
                <select
                  id="q-required"
                  name="required"
                  defaultValue="true"
                  className="h-12 w-full appearance-none rounded-xl border border-border bg-surface px-4 text-[0.9375rem] text-ink shadow-subtle focus:border-plp-400 focus:shadow-glow-brand focus:outline-none"
                >
                  <option value="true">Required</option>
                  <option value="false">Optional</option>
                </select>
              </div>
            </div>

            {type === "multiple_choice" && (
              <div className="space-y-2">
                <Label htmlFor="q-options">Answer options</Label>
                <Textarea
                  id="q-options"
                  name="options"
                  rows={4}
                  placeholder={"One per line, for example:\nYes\nNo\nNot sure"}
                />
                <p className="text-[0.75rem] text-ink-muted">
                  At least two, one per line. Each must be different.
                </p>
              </div>
            )}

            <Button type="submit" loading={pending}>
              <Plus aria-hidden="true" />
              Add to the application
            </Button>
          </form>
        )}
      </Panel>

      {/* =============== Questions from the verified form ===============
          Hidden entirely when this deployment asks none of them: an empty
          panel headed "Verified · locked" reads as something being broken.
          The withheld count is reported on the panel above instead. */}
      {seeded.length > 0 && (
      <Panel
        title={withheldCount > 0 ? "Applicant details" : "Questions from the PLP form"}
        description={
          withheldCount > 0
            ? `${seeded.length} question${seeded.length === 1 ? "" : "s"} carried over from the verified PLP form. ` +
              `The other ${withheldCount} belong to the termly baseline survey and are not asked on this application — they are kept, not deleted.`
            : `${seeded.length} questions extracted and verified from the original Google Form. These cannot be edited or removed.`
        }
        actions={
          <Badge variant="outline" size="md">
            <ShieldCheck className="size-3" aria-hidden="true" />
            Verified · locked
          </Badge>
        }
      >
        <div className="space-y-6">
          {seededGroups.map((group) => (
            <section key={group.kind}>
              <GroupHeading
                icon={group.icon}
                label={group.label}
                count={group.questions.length}
              />

              <ol className="mt-2 space-y-1">
                {group.questions.map((question) => (
                  <li
                    key={question.entryId}
                    className="flex items-start gap-3 rounded-xl px-2 py-2 text-[0.875rem] transition-colors hover:bg-paper"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-plp-50 text-[0.6875rem] font-semibold tabular-nums text-plp-700"
                    >
                      {question.orderIndex + 1}
                    </span>
                    <span className="min-w-0 flex-1 leading-snug text-ink-soft">
                      {question.title}
                    </span>
                    {question.options && question.options.length > 2 && (
                      <span className="shrink-0 text-[0.75rem] tabular-nums text-ink-faint">
                        {question.options.length} options
                      </span>
                    )}
                    {!question.isRequired && (
                      <Badge variant="outline" size="sm" className="shrink-0">
                        Optional
                      </Badge>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </Panel>
      )}
    </div>
  );
}