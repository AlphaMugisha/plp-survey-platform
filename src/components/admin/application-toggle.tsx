"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Lock, PlayCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/admin/ui";
import type { ActionResult } from "@/app/admin/surveys/actions";
import { cn } from "@/lib/utils";

/**
 * Open or close applications from the dashboard.
 *
 * One control that works in both directions, and always states the current
 * state — the previous version only offered "Open", and disappeared entirely
 * once applications were open, so there was no way to close them again.
 *
 * Closing never touches submissions already received.
 */
export function ApplicationToggle({
  surveyId,
  isOpen,
  responseCount,
  canManage,
  toggle,
}: {
  surveyId: string;
  isOpen: boolean;
  responseCount: number;
  canManage: boolean;
  toggle: (formData: FormData) => Promise<ActionResult>;
}) {
  const [result, setResult] = React.useState<ActionResult | null>(null);
  const [pending, setPending] = React.useState(false);
  const [confirmClose, setConfirmClose] = React.useState(false);

  async function run(formData: FormData) {
    setPending(true);
    setResult(null);
    try {
      setResult(await toggle(formData));
      setConfirmClose(false);
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
    <Panel
      title={isOpen ? "Applications are open" : "Applications are closed"}
      description={
        isOpen
          ? "Students can submit right now. Closing stops new submissions; everything already received is kept."
          : "No new submissions are being accepted. Opening makes the application available immediately."
      }
      className={cn(
        "mb-6",
        isOpen ? "border-success/30 bg-success-soft/50" : "border-border",
      )}
      actions={
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.75rem] font-medium",
            isOpen
              ? "border-success/30 bg-success-soft text-success"
              : "border-border bg-muted text-ink-muted",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "size-1.5 rounded-full",
              isOpen ? "bg-success" : "bg-ink-faint",
            )}
          />
          {isOpen ? "Live" : "Not accepting"}
        </span>
      }
    >
      {result && (
        <div
          role="status"
          className={cn(
            "mb-4 flex items-start gap-3 rounded-2xl border p-4",
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

      {!canManage ? (
        <p className="flex items-center gap-2 text-[0.875rem] text-ink-muted">
          <Lock className="size-4 shrink-0" aria-hidden="true" />
          Your role is read-only. Ask an owner to change this.
        </p>
      ) : isOpen ? (
        confirmClose ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[0.875rem] text-ink-soft">
              Close applications now?{" "}
              {responseCount > 0 && (
                <span className="text-ink-muted">
                  The {responseCount} submission{responseCount === 1 ? "" : "s"} already
                  received will be kept.
                </span>
              )}
            </p>
            <form action={run} className="flex gap-2">
              <input type="hidden" name="surveyId" value={surveyId} />
              <input type="hidden" name="next" value="closed" />
              <Button type="submit" variant="destructive" size="md" disabled={pending}>
                <XCircle aria-hidden="true" />
                Yes, close
              </Button>
            </form>
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setConfirmClose(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={pending}
            onClick={() => setConfirmClose(true)}
          >
            <XCircle aria-hidden="true" />
            Close applications
          </Button>
        )
      ) : (
        <form action={run}>
          <input type="hidden" name="surveyId" value={surveyId} />
          <input type="hidden" name="next" value="active" />
          <Button type="submit" size="lg" loading={pending}>
            <PlayCircle aria-hidden="true" />
            Open applications
          </Button>
        </form>
      )}
    </Panel>
  );
}
