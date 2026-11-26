import { cn } from "@/lib/utils";

/**
 * The 5-point scale, shown once per section.
 *
 * The original form repeats this legend under every rating question — all 21 of
 * them — which is a wall of pipe characters that nobody reads. Every word of it
 * is still here, laid out as a key instead of a run-on line, and shown once at
 * the top of the section it governs.
 *
 * Nothing is lost: the option rows under each question already carry the full
 * original option strings, and each question points at this element through
 * `aria-describedby`, so a screen reader still announces the scale per question.
 */
export function ScaleKey({
  legend,
  id,
  className,
}: {
  /** The exact legend text from the source, e.g. "1 = Strongly Disagree …". */
  legend: string;
  id?: string;
  className?: string;
}) {
  // Split on the separator the original uses. Each part stays verbatim.
  const points = legend
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  // If it does not look like the expected legend, show it untouched.
  if (points.length < 2) {
    return (
      <p id={id} className={cn("text-[0.875rem] leading-relaxed text-ink-muted", className)}>
        {legend}
      </p>
    );
  }

  return (
    <div
      id={id}
      className={cn(
        "rounded-2xl border border-border bg-white px-4 py-3.5 shadow-subtle sm:px-5",
        className,
      )}
    >
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-plp-600">
        Rating scale
      </p>

      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2.5">
        {points.map((point) => {
          // "1 = Strongly Disagree / Not at all" -> number + wording
          const match = /^(\d+)\s*=\s*(.*)$/u.exec(point);
          const number = match?.[1];
          const wording = match?.[2] ?? point;

          return (
            <li key={point} className="flex items-center gap-2">
              {number && (
                <span
                  aria-hidden="true"
                  className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-plp-50 text-[0.75rem] font-bold tabular-nums text-plp-700"
                >
                  {number}
                </span>
              )}
              <span className="text-[0.8125rem] leading-snug text-ink-soft">
                {/* Screen readers get the complete original phrasing. */}
                <span className="sr-only">{point}</span>
                <span aria-hidden="true">{wording}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
