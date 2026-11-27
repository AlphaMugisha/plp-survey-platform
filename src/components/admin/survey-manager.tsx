"use client";

import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  CopyPlus,
  Lock,
  ListPlus,
  Pencil,
  PlayCircle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/admin/ui";
import type { ActionResult } from "@/app/admin/surveys/actions";
import type { SurveyWithCounts } from "@/lib/admin/queries";
import { formatDate } from "@/lib/utils";

type Action = (formData: FormData) => Promise<ActionResult>;

/**
 * Survey management UI.
 *
 * Content-destructive operations are not offered at all: a survey with
 * responses can only be activated or closed, never re-worded. Creating the next
 * term's survey copies the instrument into a NEW row.
 */
export function SurveyManager({
  surveys,
  canManage,
  actions,
}: {
  surveys: SurveyWithCounts[];
  canManage: boolean;
  actions: {
    setStatus: Action;
    create: Action;
    updateDraft: Action;
  };
}) {
  const [result, setResult] = React.useState<ActionResult | null>(null);
  const [pending, setPending] = React.useState(false);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);

  async function run(action: Action, formData: FormData) {
    setPending(true);
    setResult(null);
    try {
      const res = await action(formData);
      setResult(res);
      if (res.ok) {
        setEditing(null);
        setCreating(false);
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
      {/* ---- Action feedback ---- */}
      {result && (
        <div
          role="status"
          className={[
            "flex items-start gap-3 rounded-2xl border p-4 sm:p-5",
            result.ok
              ? "border-success/25 bg-success-soft"
              : "border-destructive/30 bg-destructive-soft",
          ].join(" ")}
        >
          {result.ok ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
          ) : (
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
          )}
          <p
            className={[
              "text-[0.9375rem] leading-relaxed",
              result.ok ? "text-plp-800" : "text-destructive",
            ].join(" ")}
          >
            {result.ok ? result.message : result.error}
          </p>
        </div>
      )}

      {!canManage && (
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 shadow-subtle">
          <Lock className="mt-0.5 size-[1.125rem] shrink-0 text-ink-muted" aria-hidden="true" />
          <p className="text-[0.875rem] leading-relaxed text-ink-muted">
            Your role is read-only. You can view surveys but not change them.
          </p>
        </div>
      )}

      {/* ---- Survey list ---- */}
      {surveys.map((survey) => {
        const hasResponses = survey.response_count > 0;
        const contentFrozen = hasResponses || survey.is_locked;

        return (
          <Panel
            key={survey.id}
            title={survey.title}
            description={`/${survey.slug} · version ${survey.version}`}
            actions={
              <>
                <Badge
                  variant={
                    survey.status === "active"
                      ? "success"
                      : survey.status === "closed"
                        ? "neutral"
                        : "accent"
                  }
                  size="md"
                >
                  {survey.status}
                </Badge>
                {contentFrozen && (
                  <Badge variant="outline" size="md">
                    <Lock className="size-3" aria-hidden="true" />
                    Content locked
                  </Badge>
                )}
              </>
            }
          >
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <dl className="grid gap-4 sm:grid-cols-3">
                <Fact label="Responses" value={survey.response_count.toLocaleString()} />
                <Fact
                  label="Published"
                  value={survey.published_at ? formatDate(survey.published_at) : "—"}
                />
                <Fact
                  label="Closed"
                  value={survey.closed_at ? formatDate(survey.closed_at) : "—"}
                />
              </dl>

              {canManage && (
                <div className="flex flex-wrap gap-2.5">
                  {survey.status !== "active" && (
                    <StatusButton
                      surveyId={survey.id}
                      status="active"
                      label={survey.status === "closed" ? "Reopen applications" : "Open applications"}
                      icon={<PlayCircle aria-hidden="true" />}
                      size="lg"
                      pending={pending}
                      onRun={(fd) => run(actions.setStatus, fd)}
                    />
                  )}
                  {survey.status === "active" && (
                    <StatusButton
                      surveyId={survey.id}
                      status="closed"
                      label="Close"
                      icon={<XCircle aria-hidden="true" />}
                      variant="outline"
                      pending={pending}
                      onRun={(fd) => run(actions.setStatus, fd)}
                    />
                  )}
                  {!contentFrozen && survey.status === "draft" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      disabled={pending}
                      onClick={() => setEditing(editing === survey.id ? null : survey.id)}
                    >
                      <Pencil aria-hidden="true" />
                      {editing === survey.id ? "Cancel" : "Edit draft"}
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* ---- Draft editor ---- */}
            {editing === survey.id && canManage && (
              <form
                className="mt-6 space-y-4 border-t border-border/70 pt-6"
                action={(fd) => run(actions.updateDraft, fd)}
              >
                <input type="hidden" name="surveyId" value={survey.id} />
                <div className="space-y-2">
                  <Label htmlFor={`title-${survey.id}`}>Title</Label>
                  <Input
                    id={`title-${survey.id}`}
                    name="title"
                    defaultValue={survey.title}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`desc-${survey.id}`}>Introduction</Label>
                  <Textarea
                    id={`desc-${survey.id}`}
                    name="description"
                    rows={4}
                    defaultValue={survey.description ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`conf-${survey.id}`}>Confirmation message</Label>
                  <Textarea
                    id={`conf-${survey.id}`}
                    name="confirmationMessage"
                    rows={3}
                    defaultValue={survey.confirmation_message ?? ""}
                  />
                </div>
                <p className="text-[0.75rem] leading-relaxed text-ink-faint">
                  Only the wrapper text can be edited here. Questions and answer options are
                  seeded from the verified source file and are never edited through the dashboard.
                </p>
                <Button type="submit" loading={pending}>
                  Save draft
                </Button>
              </form>
            )}

            {/* Adding and removing questions lives on its own panel below,
                so there is one place to manage them rather than a form
                buried inside each survey card. */}
          </Panel>
        );
      })}

      {/* ---- Create next survey ---- */}
      {canManage && (
        <Panel
          title="Create the next survey"
          description="Copies an existing survey's sections and questions into a new draft. The original and its responses are untouched."
          actions={
            !creating ? (
              <Button type="button" variant="outline" size="md" onClick={() => setCreating(true)}>
                <CopyPlus aria-hidden="true" />
                New survey
              </Button>
            ) : (
              <Button type="button" variant="ghost" size="md" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            )
          }
        >
          {creating ? (
            <form className="space-y-4" action={(fd) => run(actions.create, fd)}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new-title">Title</Label>
                  <Input
                    id="new-title"
                    name="title"
                    placeholder="PLP Survey 2 — End of Term 1"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-slug">URL slug</Label>
                  <Input
                    id="new-slug"
                    name="slug"
                    placeholder="plp-survey-2-end-term-1"
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-template">Copy questions from</Label>
                <select
                  id="new-template"
                  name="templateSurveyId"
                  required
                  defaultValue={surveys[0]?.id ?? ""}
                  className="h-12 w-full appearance-none rounded-xl border border-border bg-surface px-4 text-[0.9375rem] text-ink shadow-subtle focus:border-plp-400 focus:shadow-glow-brand focus:outline-none"
                >
                  {surveys.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-desc">Introduction (optional)</Label>
                <Textarea
                  id="new-desc"
                  name="description"
                  rows={3}
                  placeholder="Leave blank to reuse the copied survey's introduction."
                />
              </div>

              <p className="text-[0.75rem] leading-relaxed text-ink-faint">
                The new survey is created as a <strong>draft</strong>. Activating it locks its
                content and starts accepting responses.
              </p>

              <Button type="submit" loading={pending}>
                <CopyPlus aria-hidden="true" />
                Create draft
              </Button>
            </form>
          ) : (
            <p className="text-[0.9375rem] leading-relaxed text-ink-muted">
              End-of-term and end-of-year surveys should reuse the baseline instrument so answers
              stay comparable. Creating a copy keeps each term&apos;s submissions attached to the
              survey they were answered on.
            </p>
          )}
        </Panel>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function StatusButton({
  surveyId,
  status,
  label,
  icon,
  variant = "primary",
  size = "md",
  pending,
  onRun,
}: {
  surveyId: string;
  status: "draft" | "active" | "closed";
  label: string;
  icon: React.ReactNode;
  variant?: "primary" | "outline";
  size?: "md" | "lg" | "xl";
  pending: boolean;
  onRun: (formData: FormData) => void;
}) {
  return (
    <form action={onRun}>
      <input type="hidden" name="surveyId" value={surveyId} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" variant={variant} size={size} disabled={pending}>
        {icon}
        {label}
      </Button>
    </form>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-muted">
        {label}
      </dt>
      <dd className="mt-1 font-display text-[1.125rem] font-semibold tabular-nums text-plp-800">
        {value}
      </dd>
    </div>
  );
}
