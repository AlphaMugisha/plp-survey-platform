"use client";

import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  ListChecks,
  Lock,
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

/**
 * Manage the questions on the live application.
 *
 * Two classes of question, shown together but never confusable:
 *
 *   Seeded   — the questions extracted and verified from the PLP Google Form.
 *              Locked. No remove control is rendered at all for them.
 *   Added    — questions an administrator appended here. Removable, but only
 *              until someone answers one.
 *
 * The same two rules are enforced by the server action and, independently, by
 * a database trigger. This UI only reflects them.
 */
export function QuestionManager({
  surveyId,
  questions,
  canManage,
  actions,
}: {
  surveyId: string;
  questions: ManagedQuestion[];
  canManage: boolean;
  actions: { add: Action; remove: Action };
}) {
  const [result, setResult] = React.useState<ActionResult | null>(null);
  const [pending, setPending] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [type, setType] = React.useState<"paragraph" | "multiple_choice">("paragraph");
  const [confirming, setConfirming] = React.useState<number | null>(null);

  const seeded = questions.filter((q) => !q.isCustom);
  const added = questions.filter((q) => q.isCustom);

  async function run(action: Action, formData: FormData) {
    setPending(true);
    setResult(null);
    try {
      const res = await action(formData);
      setResult(res);
      if (res.ok) {
        setAdding(false);
        setConfirming(null);
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

      {/* ---- Questions you added ---- */}
      <Panel
        title="Questions you added"
        description={
          added.length === 0
            ? "Questions added here appear on the application straight away."
            : `${added.length} added. They appear after the ${seeded.length} questions from the PLP form.`
        }
        bodyClassName={added.length === 0 ? "p-0" : undefined}
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
          <ul className="space-y-3">
            {added.map((question) => (
              <li
                key={question.entryId}
                className="card-quiet rounded-2xl border border-border bg-white p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="brand" size="sm">
                        {question.type === "multiple_choice" ? (
                          <ListChecks className="size-3" aria-hidden="true" />
                        ) : (
                          <Type className="size-3" aria-hidden="true" />
                        )}
                        {question.type === "multiple_choice" ? "Choice" : "Written"}
                      </Badge>
                      <Badge variant={question.isRequired ? "neutral" : "outline"} size="sm">
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
                        confirming === question.entryId ? (
                          <form
                            action={(fd) => run(actions.remove, fd)}
                            className="flex items-center gap-2"
                          >
                            <input type="hidden" name="surveyId" value={surveyId} />
                            <input type="hidden" name="entryId" value={question.entryId} />
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
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted px-2.5 py-1.5 text-[0.75rem] text-ink-muted">
                          <Lock className="size-3.5" aria-hidden="true" />
                          Answered
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* ---- Add form ---- */}
        {adding && canManage && (
          <form
            className="mt-5 space-y-4 border-t border-border pt-5"
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

      {/* ---- Questions from the verified form ---- */}
      <Panel
        title="Questions from the PLP form"
        description="Extracted and verified from the original Google Form. These cannot be edited or removed."
        actions={
          <Badge variant="outline" size="md">
            <ShieldCheck className="size-3" aria-hidden="true" />
            Verified · locked
          </Badge>
        }
      >
        <ol className="space-y-1.5">
          {seeded.map((question, i) => (
            <li
              key={question.entryId}
              className="flex items-start gap-3 rounded-xl px-2 py-2 text-[0.875rem] transition-colors hover:bg-paper"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-plp-50 text-[0.6875rem] font-semibold tabular-nums text-plp-700"
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 leading-snug text-ink-soft">{question.title}</span>
              {!question.isRequired && (
                <Badge variant="outline" size="sm" className="shrink-0">
                  Optional
                </Badge>
              )}
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}
