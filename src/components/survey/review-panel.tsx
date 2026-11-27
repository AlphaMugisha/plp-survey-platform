"use client";

import { AlertCircle, Mail, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { surveySteps as defaultSteps, type SurveyStep } from "@/lib/survey/steps";
import type { SurveyFormValues } from "@/lib/survey/schema";

/**
 * Review-before-submit.
 *
 * Answers are shown as the EXACT strings that will be stored — the full original
 * option text for choice questions, not a number or an abbreviation.
 */
export function ReviewPanel({
  values,
  onEditStep,
  missingFields,
  steps = defaultSteps,
}: {
  values: SurveyFormValues;
  onEditStep: (stepIndex: number) => void;
  /** Field keys that are required but still empty. */
  missingFields: Set<string>;
  steps?: SurveyStep[];
}) {
  const answerSteps = steps.filter((s) => s.kind !== "review");

  return (
    <div className="space-y-5">
      {missingFields.size > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive-soft p-4 sm:p-5">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
          <div>
            <p className="text-[0.9375rem] font-medium text-destructive">
              {missingFields.size} required{" "}
              {missingFields.size === 1 ? "answer is" : "answers are"} still missing.
            </p>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-destructive/85">
              The missing answers are highlighted below. Use Edit to go back and complete them.
            </p>
          </div>
        </div>
      )}

      {answerSteps.map((step) => {
        const stepIndex = steps.findIndex((s) => s.id === step.id);
        const showEmail = step.kind === "details";

        return (
          <section key={step.id} className="card-lux overflow-hidden">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-paper/60 px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <h3 className="font-display text-[1.0625rem] font-semibold leading-snug tracking-tight text-plp-800">
                  {step.kind === "section" && step.section
                    ? step.section.title
                    : step.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onEditStep(stepIndex)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-plp-700/20 bg-surface px-3 py-1.5",
                  "text-[0.8125rem] font-medium text-plp-700 shadow-subtle",
                  "transition-all duration-200 ease-premium hover:border-plp-700/35 hover:bg-plp-50",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plp-500 focus-visible:ring-offset-2",
                )}
              >
                <Pencil className="size-3.5" aria-hidden="true" />
                Edit
              </button>
            </header>

            <dl className="divide-y divide-border/60">
              {showEmail && (
                <>
                  <ReviewRow
                    label="Email"
                    icon={<Mail className="size-4" aria-hidden="true" />}
                    value={values.email?.trim() ?? ""}
                    missing={missingFields.has("email")}
                  />
                  <ReviewRow
                    label="Country you are from"
                    value={values.country_of_origin?.trim() ?? ""}
                    missing={missingFields.has("country_of_origin")}
                  />
                </>
              )}

              {step.questions.map((question) => (
                <ReviewRow
                  key={question.entry_id}
                  label={question.title}
                  value={(values[question.fieldKey] ?? "").trim()}
                  optional={!question.required}
                  missing={missingFields.has(question.fieldKey)}
                />
              ))}
            </dl>
          </section>
        );
      })}
    </div>
  );
}

function ReviewRow({
  label,
  value,
  icon,
  optional = false,
  missing = false,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  optional?: boolean;
  missing?: boolean;
}) {
  const hasValue = value.length > 0;

  return (
    <div
      className={cn(
        "grid gap-1.5 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-6 sm:px-6",
        missing && "bg-destructive-soft/60",
      )}
    >
      <dt className="flex items-start gap-2 text-[0.9375rem] leading-snug text-ink-soft">
        {icon && <span className="mt-0.5 shrink-0 text-ink-faint">{icon}</span>}
        <span className="min-w-0">{label}</span>
      </dt>
      <dd className="min-w-0">
        {hasValue ? (
          /* whitespace-pre-line keeps paragraph line breaks the student typed */
          <span className="whitespace-pre-line break-words text-[0.9375rem] font-medium leading-relaxed text-plp-800">
            {value}
          </span>
        ) : missing ? (
          <Badge variant="danger" size="sm">
            <AlertCircle className="size-3" aria-hidden="true" />
            Required — not answered
          </Badge>
        ) : (
          <span className="text-[0.9375rem] italic text-ink-faint">
            {optional ? "Not answered (optional)" : "Not answered"}
          </span>
        )}
      </dd>
    </div>
  );
}
