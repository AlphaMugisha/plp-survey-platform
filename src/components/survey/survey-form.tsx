"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Mail,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, RequiredMark } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ProgressRail } from "./progress-rail";
import { QuestionField } from "./question-field";
import { ReviewPanel } from "./review-panel";
import { ScaleKey } from "./scale-key";
import {
  allQuestions,
  isScaleLegend,
  surveySource,
  BASELINE_SURVEY_SLUG,
} from "@/lib/survey/source";
import {
  emptyFormValues,
  fullSurveySchema,
  type SurveyFormValues,
} from "@/lib/survey/schema";
import { REVIEW_STEP_INDEX, fieldsForStep, surveySteps } from "@/lib/survey/steps";
import { cn } from "@/lib/utils";

const DRAFT_KEY = "plp-survey-draft-v1";

/** One scale key per section; every rating question references it. */
const SCALE_LEGEND_ID = "section-scale-key";

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string; detail?: string[] };

export function SurveyForm() {
  const router = useRouter();
  const reduce = useReducedMotion();

  const [stepIndex, setStepIndex] = React.useState(0);
  const [furthest, setFurthest] = React.useState(0);
  const [submitState, setSubmitState] = React.useState<SubmitState>({ status: "idle" });
  const [draftRestored, setDraftRestored] = React.useState(false);

  const startedAtRef = React.useRef<string>(new Date().toISOString());
  const topRef = React.useRef<HTMLDivElement>(null);

  const form = useForm<SurveyFormValues>({
    resolver: zodResolver(fullSurveySchema),
    defaultValues: emptyFormValues(),
    mode: "onTouched",
    reValidateMode: "onChange",
    shouldFocusError: false,
  });

  const {
    control,
    handleSubmit,
    trigger,
    getValues,
    watch,
    reset,
    setFocus,
    register,
    formState: { errors },
  } = form;

  const step = surveySteps[stepIndex]!;
  const isReview = step.kind === "review";
  const values = watch();

  /**
   * A section description is either prose, the scale legend, or prose followed
   * by the legend after a blank line. Split them so the prose reads as prose
   * and the legend becomes a proper key — without altering either.
   */
  const { prose, legend } = React.useMemo(() => {
    const text = step.description;
    if (!text) return { prose: null as string | null, legend: null as string | null };

    const blocks = text
      .split(/\n{2,}/u)
      .map((b) => b.trim())
      .filter(Boolean);
    const legendBlocks = blocks.filter((b) => isScaleLegend(b));
    const proseBlocks = blocks.filter((b) => !isScaleLegend(b));

    return {
      prose: proseBlocks.length > 0 ? proseBlocks.join("\n\n") : null,
      legend: legendBlocks.length > 0 ? legendBlocks[0]! : null,
    };
  }, [step.description]);

  /* ---------------- Draft persistence ----------------
     Answers survive an accidental refresh or a dropped connection. Stored only
     in this browser and cleared the moment the response is accepted. */

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DRAFT_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as {
        values?: SurveyFormValues;
        stepIndex?: number;
        furthest?: number;
        startedAt?: string;
      };
      if (parsed.values) {
        reset({ ...emptyFormValues(), ...parsed.values });
        setDraftRestored(true);
      }
      if (typeof parsed.furthest === "number") {
        setFurthest(Math.min(Math.max(parsed.furthest, 0), REVIEW_STEP_INDEX));
      }
      if (typeof parsed.stepIndex === "number") {
        setStepIndex(Math.min(Math.max(parsed.stepIndex, 0), REVIEW_STEP_INDEX));
      }
      if (parsed.startedAt) startedAtRef.current = parsed.startedAt;
    } catch {
      // A corrupt draft must never block the survey.
    }
  }, [reset]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            values,
            stepIndex,
            furthest,
            startedAt: startedAtRef.current,
          }),
        );
      } catch {
        // Storage can be full or blocked (private mode) — not fatal.
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [values, stepIndex, furthest]);

  /* ---------------- Progress ---------------- */

  const answeredCount = React.useMemo(() => {
    let n = (values.email ?? "").trim() ? 1 : 0;
    for (const q of allQuestions) {
      if ((values[q.fieldKey] ?? "").trim()) n += 1;
    }
    return n;
  }, [values]);

  const totalFields = allQuestions.length + (surveySource.collects_email.enabled ? 1 : 0);
  const percent = Math.min(100, (answeredCount / totalFields) * 100);

  /** Required fields still empty — drives the review screen's warning. */
  const missingFields = React.useMemo(() => {
    const missing = new Set<string>();
    if (surveySource.collects_email.required && !(values.email ?? "").trim()) {
      missing.add("email");
    }
    for (const q of allQuestions) {
      if (q.required && !(values[q.fieldKey] ?? "").trim()) missing.add(q.fieldKey);
    }
    return missing;
  }, [values]);

  /* ---------------- Navigation ---------------- */

  function scrollToTop() {
    topRef.current?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
  }

  async function goNext() {
    const fields = fieldsForStep(step) as Array<keyof SurveyFormValues>;
    const valid = fields.length === 0 ? true : await trigger(fields, { shouldFocus: false });

    if (!valid) {
      // Move focus to the first field that failed, so keyboard and screen-reader
      // users are taken straight to the problem.
      const firstBad = fields.find((f) => errors[f as string]);
      if (firstBad) setFocus(firstBad as never);
      return;
    }

    const next = Math.min(stepIndex + 1, REVIEW_STEP_INDEX);
    setStepIndex(next);
    setFurthest((f) => Math.max(f, next));
    scrollToTop();
  }

  function goPrev() {
    setStepIndex((i) => Math.max(0, i - 1));
    scrollToTop();
  }

  function jumpTo(index: number) {
    if (index > furthest) return;
    setStepIndex(index);
    scrollToTop();
  }

  /* ---------------- Submit ---------------- */

  async function onSubmit(formValues: SurveyFormValues) {
    setSubmitState({ status: "submitting" });

    // Answers are keyed by the ORIGINAL Google entry id, so the payload cannot
    // drift from the source definition.
    const answers: Record<string, string> = {};
    for (const q of allQuestions) {
      const value = (formValues[q.fieldKey] ?? "").trim();
      if (value) answers[String(q.entry_id)] = value;
    }

    const durationSeconds = Math.max(
      0,
      Math.round((Date.now() - new Date(startedAtRef.current).getTime()) / 1000),
    );

    try {
      const response = await fetch("/api/survey/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surveySlug: BASELINE_SURVEY_SLUG,
          email: (formValues.email ?? "").trim(),
          answers,
          meta: { startedAt: startedAtRef.current, durationSeconds },
        }),
      });

      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        issues?: Array<{ message: string; field?: string }>;
      };

      if (!response.ok) {
        setSubmitState({
          status: "error",
          message: body.error ?? "We could not submit your answers. Please try again.",
          detail: body.issues?.map((i) => i.message),
        });
        scrollToTop();
        return;
      }

      // Accepted — clear the local draft so a shared device keeps nothing.
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      router.push("/survey/thank-you");
    } catch {
      setSubmitState({
        status: "error",
        message:
          "We could not reach the server. Check your connection and try again — your answers are saved in this browser.",
      });
      scrollToTop();
    }
  }

  const submitting = submitState.status === "submitting";

  /* ---------------- Render ---------------- */

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div ref={topRef} className="scroll-mt-6" />

      {/* ---- Sticky progress header ---- */}
      {/* Full-bleed within the container: the negative margins must match the
          container's own padding at every breakpoint (1.25rem / 2rem / 2.5rem),
          otherwise content scrolls through an uncovered strip at each edge. */}
      <div className="sticky top-0 z-30 -mx-5 mb-8 border-b border-border/70 bg-paper/85 px-5 py-4 backdrop-blur-md sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
        <ProgressRail
          steps={surveySteps}
          current={stepIndex}
          furthest={furthest}
          onJump={jumpTo}
          percent={percent}
        />
      </div>

      {draftRestored && stepIndex === furthest && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-plp-200 bg-plp-50/70 p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-plp-600" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[0.9375rem] font-medium text-plp-800">
              We restored your saved answers.
            </p>
            <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-ink-muted">
              Nothing has been submitted yet. Carry on where you left off.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDraftRestored(false)}
            className="ml-auto shrink-0 rounded-lg px-2 py-1 text-[0.8125rem] font-medium text-plp-700 hover:bg-plp-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ---- Submission error ---- */}
      {submitState.status === "error" && (
        <div
          role="alert"
          className="mb-6 rounded-2xl border border-destructive/30 bg-destructive-soft p-4 sm:p-5"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-[0.9375rem] font-medium text-destructive">
                {submitState.message}
              </p>
              {submitState.detail && submitState.detail.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[0.8125rem] text-destructive/85">
                  {submitState.detail.slice(0, 6).map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---- Step body ---- */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step.id}
          initial={{ opacity: 0, x: reduce ? 0 : 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: reduce ? 0 : -18 }}
          transition={{ duration: reduce ? 0.15 : 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Step heading */}
          <header className="mb-7">
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge variant="accent" size="sm">
                Step {stepIndex + 1} of {surveySteps.length}
              </Badge>
              {step.kind === "section" && (
                <Badge variant="neutral" size="sm">
                  {step.questions.length}{" "}
                  {step.questions.length === 1 ? "question" : "questions"}
                </Badge>
              )}
            </div>

            <h2 className="mt-4 text-balance font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-plp-800 sm:text-[2rem]">
              {/* Section steps show the exact original section title */}
              {step.kind === "section" && step.section ? step.section.plainTitle : step.title}
            </h2>

            {/* The section's own text. Where it is prose it reads as prose;
                where it is the scale legend it becomes the scale key below. */}
            {prose && (
              <p className="mt-3 max-w-2xl whitespace-pre-line text-pretty text-[1.0625rem] leading-relaxed text-ink-soft">
                {prose}
              </p>
            )}

            {/* Shown once for the whole section. Every rating question below
                points at it through aria-describedby. */}
            {legend && (
              <ScaleKey legend={legend} id={SCALE_LEGEND_ID} className="mt-5 max-w-2xl" />
            )}
          </header>

          {/* ---- Details step: the built-in email field, then the first three questions ---- */}
          {step.kind === "details" && (
            <div className="space-y-4">
              <div className="card-lux p-5 sm:p-6">
                <div className="flex gap-3.5 sm:gap-4">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 hidden size-7 shrink-0 items-center justify-center rounded-lg bg-plp-50 text-plp-600 sm:inline-flex"
                  >
                    <Mail className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Label htmlFor="email" className="text-[1.0625rem] font-medium">
                      {surveySource.collects_email.rendered_label}
                      {surveySource.collects_email.required && <RequiredMark />}
                    </Label>
                    <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-faint">
                      Recorded with your response so your later surveys can be matched to this
                      one.
                    </p>
                    <div className="mt-4">
                      <Input
                        id="email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        invalid={Boolean(errors.email)}
                        aria-describedby={errors.email ? "email__error" : undefined}
                        {...register("email")}
                      />
                    </div>
                    {errors.email?.message && (
                      <p
                        id="email__error"
                        role="alert"
                        className="mt-3 flex items-start gap-2 text-[0.8125rem] font-medium text-destructive"
                      >
                        <AlertCircle className="mt-px size-4 shrink-0" aria-hidden="true" />
                        {String(errors.email.message)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {step.questions.map((question, i) => (
                <QuestionField
                  key={question.entry_id}
                  question={question}
                  control={control}
                  errors={errors}
                  index={i + 1}
                />
              ))}
            </div>
          )}

          {/* ---- Section steps ---- */}
          {step.kind === "section" && (
            <div className="space-y-4">
              {step.questions.map((question, i) => (
                <QuestionField
                  key={question.entry_id}
                  question={question}
                  control={control}
                  errors={errors}
                  index={i + 1}
                  scaleLegendId={legend ? SCALE_LEGEND_ID : undefined}
                />
              ))}
            </div>
          )}

          {/* ---- Review ---- */}
          {isReview && (
            <ReviewPanel
              values={getValues()}
              onEditStep={jumpTo}
              missingFields={missingFields}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* ---- Navigation ---- */}
      <div className="mt-9 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={goPrev}
          disabled={stepIndex === 0 || submitting}
          className="w-full sm:w-auto"
        >
          <ArrowLeft aria-hidden="true" />
          Previous
        </Button>

        {isReview ? (
          <Button
            type="submit"
            size="lg"
            variant="accent"
            loading={submitting}
            disabled={submitting || missingFields.size > 0}
            className="w-full sm:w-auto"
          >
            {submitting ? "Submitting…" : "Submit survey"}
            {!submitting && <Send aria-hidden="true" />}
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            onClick={goNext}
            disabled={submitting}
            className="group w-full sm:w-auto"
          >
            {stepIndex === REVIEW_STEP_INDEX - 1 ? "Review answers" : "Continue"}
            <ArrowRight
              className="transition-transform duration-300 ease-premium group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Button>
        )}
      </div>

      {isReview && missingFields.size > 0 && (
        <p className="mt-3 text-right text-[0.8125rem] text-ink-muted">
          Complete the {missingFields.size} missing required{" "}
          {missingFields.size === 1 ? "answer" : "answers"} to submit.
        </p>
      )}
    </form>
  );
}
