"use client";

import { Check } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { SurveyStep } from "@/lib/survey/steps";

/**
 * Section progress indicator.
 *
 * Completed steps stay clickable so a participant can jump back to change an
 * answer; steps ahead stay locked until the current one validates.
 */
export function ProgressRail({
  steps,
  current,
  furthest,
  onJump,
  percent,
}: {
  steps: SurveyStep[];
  current: number;
  /** Highest step index reached so far — anything up to here is navigable. */
  furthest: number;
  onJump: (index: number) => void;
  percent: number;
}) {
  const reduce = useReducedMotion();

  return (
    <nav aria-label="Survey progress" className="w-full">
      {/* ---- Bar ---- */}
      <div className="flex items-center gap-4">
        <div
          className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-forest-100"
          role="progressbar"
          aria-valuenow={Math.round(percent)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Overall completion"
        >
          <motion.span
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-forest-600 via-forest-500 to-emerald-accent"
            initial={false}
            animate={{ width: `${percent}%` }}
            transition={{ duration: reduce ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{
              boxShadow: percent > 0 ? "0 0 12px rgba(47,163,107,0.55)" : undefined,
            }}
          />
        </div>
        <span className="shrink-0 text-[0.8125rem] font-medium tabular-nums text-ink-muted">
          {Math.round(percent)}%
        </span>
      </div>

      {/* ---- Steps ---- */}
      <ol className="mt-4 flex items-center gap-1.5 overflow-x-panel pb-1 sm:gap-2">
        {steps.map((step, index) => {
          const isCurrent = index === current;
          const isDone = index < furthest || (index < current && index <= furthest);
          const reachable = index <= furthest;

          return (
            <li key={step.id} className="shrink-0">
              <button
                type="button"
                onClick={() => reachable && onJump(index)}
                disabled={!reachable}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl border px-3 py-2",
                  "text-[0.8125rem] font-medium transition-all duration-250 ease-premium",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-500 focus-visible:ring-offset-2",
                  isCurrent
                    ? "border-forest-500 bg-forest-50 text-forest-800 shadow-glow-emerald"
                    : isDone
                      ? "border-border bg-surface text-forest-700 hover:border-forest-300 hover:bg-forest-50/60"
                      : "border-transparent bg-transparent text-ink-faint",
                  !reachable && "cursor-not-allowed",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-flex size-5 items-center justify-center rounded-full text-[0.6875rem] font-semibold tabular-nums transition-colors duration-250",
                    isCurrent
                      ? "bg-forest-sheen text-cream-warm"
                      : isDone
                        ? "bg-forest-100 text-forest-700"
                        : "bg-muted text-ink-faint",
                  )}
                >
                  {isDone && !isCurrent ? <Check className="size-3" strokeWidth={3} /> : index + 1}
                </span>
                {step.label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
