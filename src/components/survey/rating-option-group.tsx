"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { composeFillIn, fillInPrefix, MAX_FILL_IN } from "@/lib/survey/fill-in-option";

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
        // An option ending in a blank ("Other: __________") is filled in rather
        // than merely chosen, so it matches on its lead-in text and carries its
        // own input. See src/lib/survey/fill-in-option.ts.
        const prefix = fillInPrefix(option);
        const selected =
          prefix === null
            ? value === option
            : value === option || Boolean(value?.startsWith(prefix));
        const typed =
          prefix !== null && selected && value && value !== option
            ? value.slice(prefix.length)
            : "";
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
              onChange={() => onChange(prefix === null ? option : composeFillIn(prefix, typed))}
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

              {/* The exact original option string. Once a fill-in option is
                  chosen, the blank is replaced by the input below, which is
                  what the blank means on paper. */}
              <span
                className={cn(
                  "text-[0.9375rem] leading-snug transition-colors duration-250",
                  selected ? "font-medium text-plp-800" : "text-ink-soft",
                )}
              >
                {prefix !== null && selected ? prefix.trim() : option}
              </span>
            </label>

            {/* Outside the <label>, so typing in it cannot re-trigger the radio. */}
            {prefix !== null && selected && (
              <div className="mt-2 pl-4 sm:pl-5">
                <input
                  type="text"
                  value={typed}
                  disabled={disabled}
                  autoFocus
                  maxLength={MAX_FILL_IN}
                  onChange={(event) => onChange(composeFillIn(prefix, event.target.value))}
                  onBlur={onBlur}
                  aria-label={`${prefix.trim()} please specify`}
                  placeholder="Please specify…"
                  className={cn(
                    "w-full rounded-xl border bg-surface px-3.5 py-2.5",
                    "text-[0.9375rem] text-ink placeholder:text-ink-faint",
                    "transition-all duration-250 ease-premium",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plp-500 focus-visible:ring-offset-2",
                    invalid && typed.trim().length === 0
                      ? "border-destructive/60"
                      : "border-plp-300",
                    disabled && "cursor-not-allowed opacity-60",
                  )}
                />
              </div>
            )}
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
