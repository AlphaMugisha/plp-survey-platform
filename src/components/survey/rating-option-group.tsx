"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Rating / choice control.
 *
 * Each option row shows the COMPLETE original option string, verbatim
 * (e.g. "3 — Neutral / Sometimes"). The leading number is additionally surfaced
 * in the selection indicator, which is presentation only — the submitted value
 * is always the exact original string.
 *
 * Built on native radio inputs inside labels so that:
 *   - arrow keys move between options (native radio-group behaviour),
 *   - the whole row is a touch target (comfortable on phones),
 *   - screen readers announce the real option text.
 *
 * Rows stack vertically at every breakpoint. A 5-across desktop layout would
 * squeeze these long labels into unreadable columns.
 */
export function RatingOptionGroup({
  name,
  options,
  value,
  onChange,
  onBlur,
  describedBy,
  invalid,
  disabled,
}: {
  name: string;
  options: string[];
  value: string | undefined;
  onChange: (value: string) => void;
  onBlur?: () => void;
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      className="grid gap-2.5"
      role="radiogroup"
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
    >
      {options.map((option) => {
        const selected = value === option;
        const id = `${name}__${slug(option)}`;
        // Leading number, used only for the indicator glyph.
        const ordinal = /^(\d+)/u.exec(option)?.[1];

        return (
          <div key={option} className="relative">
            <input
              type="radio"
              id={id}
              name={name}
              value={option}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(option)}
              onBlur={onBlur}
              className="peer sr-only"
            />
            <label
              htmlFor={id}
              className={cn(
                "flex cursor-pointer items-center gap-4 rounded-2xl border bg-surface",
                "px-4 py-3.5 sm:px-5",
                "transition-all duration-250 ease-premium",
                "peer-focus-visible:ring-2 peer-focus-visible:ring-plp-500 peer-focus-visible:ring-offset-2",
                "hover:border-plp-300 hover:bg-plp-50/40",
                selected
                  ? "border-plp-500 bg-plp-50/70 shadow-glow-brand"
                  : "border-border shadow-subtle",
                invalid && !selected && "border-destructive/40",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              {/* Indicator: shows the option's number until selected, then a tick */}
              <span
                aria-hidden="true"
                className={cn(
                  "relative inline-flex size-9 shrink-0 items-center justify-center rounded-full",
                  "font-medium tabular-nums",
                  "transition-all duration-250 ease-premium",
                  selected
                    ? "bg-plp-sheen text-paper-warm shadow-button"
                    : "border border-border bg-muted/60 text-ink-muted",
                )}
              >
                {selected ? <Check className="size-[1.0625rem]" strokeWidth={2.75} /> : ordinal}
              </span>

              {/* The exact original option string */}
              <span
                className={cn(
                  "text-[0.9375rem] leading-snug transition-colors duration-250",
                  selected ? "font-medium text-plp-800" : "text-ink-soft",
                )}
              >
                {option}
              </span>
            </label>
          </div>
        );
      })}
    </div>
  );
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
}
