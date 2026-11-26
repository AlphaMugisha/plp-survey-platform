"use client";

import * as React from "react";
import { Controller, type Control, type FieldErrors } from "react-hook-form";
import { AlertCircle, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RequiredMark, OptionalMark } from "@/components/ui/label";
import { RatingOptionGroup } from "./rating-option-group";
import { SchoolCombobox } from "./school-combobox";
import { isScaleLegend, type Question } from "@/lib/survey/source";
import { cn } from "@/lib/utils";
import type { SurveyFormValues } from "@/lib/survey/schema";

/**
 * Renders one question from the source definition.
 *
 * Wording, help text, options and required status all come straight from the
 * question object — nothing is written inline here.
 */
export function QuestionField({
  question,
  control,
  errors,
  index,
  scaleLegendId,
}: {
  question: Question;
  control: Control<SurveyFormValues>;
  errors: FieldErrors<SurveyFormValues>;
  /** 1-based number shown beside the question. Presentation only. */
  index?: number;
  /**
   * Id of a shared scale key rendered once for the whole section. When given,
   * this question's own help text — which is the same legend repeated — is not
   * drawn again, but is still announced via aria-describedby.
   */
  scaleLegendId?: string;
}) {
  const error = errors[question.fieldKey];
  const message = typeof error?.message === "string" ? error.message : undefined;

  const fieldId = question.fieldKey;

  // The 21 rating questions all repeat their section's scale legend. When the
  // section already shows it, point at that one element instead of drawing the
  // same sentence under every question.
  const usesSharedLegend = Boolean(
    scaleLegendId && question.description && isScaleLegend(question.description),
  );

  const ownDescId = question.description && !usesSharedLegend ? `${fieldId}__desc` : undefined;
  const descId = usesSharedLegend ? scaleLegendId : ownDescId;
  const errorId = message ? `${fieldId}__error` : undefined;
  const describedBy = [descId, errorId].filter(Boolean).join(" ") || undefined;

  // The one optional question already carries "(Optional)" in its original
  // wording, so don't stack a second marker on top of it.
  const titleMentionsOptional = /\(optional\)/iu.test(question.title);
  const isChoice = Boolean(question.options?.length);
  const useFieldset = isChoice && question.type === "multiple_choice";

  const Wrapper = useFieldset ? "fieldset" : "div";
  const LabelTag = useFieldset ? "legend" : "label";

  return (
    <Wrapper
      className={cn(
        "card-lux scroll-mt-28 p-5 sm:p-6",
        // Quiet lift while the student is working in this question, so the one
        // they are answering stands slightly forward of the rest.
        "transition-all duration-300 ease-premium",
        "hover:border-plp-200 focus-within:border-plp-300 focus-within:shadow-card",
        message && "border-destructive/50",
      )}
      aria-invalid={message ? true : undefined}
    >
      <div className="flex gap-3.5 sm:gap-4">
        {/* Question number — presentation only */}
        {index !== undefined && (
          <span
            aria-hidden="true"
            className="mt-0.5 hidden size-7 shrink-0 select-none items-center justify-center rounded-lg bg-plp-50 font-display text-[0.8125rem] font-semibold text-plp-600 sm:inline-flex"
          >
            {index}
          </span>
        )}

        <div className="min-w-0 flex-1">
          {/* ---- Question wording, verbatim ---- */}
          <LabelTag
            {...(useFieldset ? {} : { htmlFor: fieldId })}
            className={cn(
              "block text-[1.0625rem] font-medium leading-snug text-ink",
              useFieldset && "float-none p-0",
            )}
          >
            {question.title}
            {question.required ? (
              <RequiredMark />
            ) : titleMentionsOptional ? null : (
              <OptionalMark />
            )}
          </LabelTag>

          {/* ---- Help text, verbatim — but only when it is not the section's
                   scale legend repeated for the twenty-first time. ---- */}
          {question.description && !usesSharedLegend && (
            <p
              id={ownDescId}
              className="mt-2 whitespace-pre-line text-[0.8125rem] leading-relaxed text-ink-muted"
            >
              {question.description}
            </p>
          )}

          {/* ---- Control ---- */}
          <div className="mt-4">
            <Controller
              name={question.fieldKey}
              control={control}
              render={({ field }) => {
                if (question.type === "dropdown") {
                  // Exactly one option: nothing to choose. Show it as settled
                  // rather than making the student open a list of one.
                  if (question.options?.length === 1) {
                    const only = question.options[0]!;
                    return (
                      <div
                        id={fieldId}
                        className="flex items-center gap-2.5 rounded-xl border border-plp-200 bg-plp-50 px-4 py-3 text-[0.9375rem] font-medium text-plp-800"
                      >
                        <Check className="size-4 shrink-0 text-plp-600" aria-hidden="true" />
                        {only}
                      </div>
                    );
                  }

                  return (
                    <SchoolCombobox
                      id={fieldId}
                      options={question.options ?? []}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      invalid={Boolean(message)}
                      describedBy={describedBy}
                    />
                  );
                }

                if (question.type === "multiple_choice") {
                  return (
                    <RatingOptionGroup
                      name={question.fieldKey}
                      options={question.options ?? []}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      invalid={Boolean(message)}
                      describedBy={describedBy}
                    />
                  );
                }

                if (question.type === "paragraph") {
                  return (
                    <Textarea
                      id={fieldId}
                      rows={5}
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      invalid={Boolean(message)}
                      aria-describedby={describedBy}
                      placeholder="Write your answer…"
                    />
                  );
                }

                return (
                  <Input
                    id={fieldId}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    invalid={Boolean(message)}
                    aria-describedby={describedBy}
                    placeholder="Your answer"
                    autoComplete={question.title.toLowerCase().includes("name") ? "name" : "off"}
                  />
                );
              }}
            />
          </div>

          {/* ---- Error ---- */}
          {message && (
            <p
              id={errorId}
              role="alert"
              className="mt-3 flex items-start gap-2 text-[0.8125rem] font-medium text-destructive"
            >
              <AlertCircle className="mt-px size-4 shrink-0" aria-hidden="true" />
              {message}
            </p>
          )}
        </div>
      </div>
    </Wrapper>
  );
}
