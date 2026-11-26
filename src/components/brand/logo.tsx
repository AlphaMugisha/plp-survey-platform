import { cn } from "@/lib/utils";

/**
 * PLP brand mark.
 *
 * ---------------------------------------------------------------------------
 * PLACEHOLDER — swap in the official asset when you have it.
 *
 * peaceloveproclaimers.org is currently suspended, so the official logo file
 * could not be retrieved. This is a clean monogram built in the organisation's
 * own brand blue (Denim #1D75BD) rather than an imitation of their logo.
 *
 * To replace it: drop the real file at `public/plp-logo.svg` and swap the SVG
 * below for `<img src="/plp-logo.svg" alt="Peace and Love Proclaimers" />`.
 * Nothing else in the app needs to change — every surface uses this component.
 * ---------------------------------------------------------------------------
 */
export function LogoMark({
  className,
  tone = "light",
}: {
  className?: string;
  /** "light" = on white surfaces, "dark" = on deep navy panels */
  tone?: "light" | "dark";
}) {
  const bg = tone === "dark" ? "#FFFFFF" : "#1D75BD";
  const fg = tone === "dark" ? "#0A2741" : "#FFFFFF";

  return (
    <svg
      viewBox="0 0 40 40"
      className={cn("size-9", className)}
      role="img"
      aria-label="Peace and Love Proclaimers"
    >
      <rect width="40" height="40" rx="11" fill={bg} />
      {/* Set as SVG text so the monogram always reads as "PLP" — drawing the
          letterforms as paths made the third P read as an "i" at small sizes. */}
      <text
        x="20"
        y="20.5"
        textAnchor="middle"
        dominantBaseline="central"
        fill={fg}
        fontSize="13.5"
        fontWeight="800"
        letterSpacing="-0.4"
        fontFamily="var(--font-sans), system-ui, sans-serif"
      >
        PLP
      </text>
    </svg>
  );
}

/** Full lockup: mark + wordmark + optional tagline. */
export function Logo({
  className,
  tone = "light",
  showTagline = false,
}: {
  className?: string;
  tone?: "light" | "dark";
  showTagline?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark tone={tone} className="size-9 shrink-0" />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display text-[1.0625rem] font-bold tracking-tight",
            tone === "dark" ? "text-white" : "text-plp-800",
          )}
        >
          Peace &amp; Love Proclaimers
        </span>
        {showTagline && (
          <span
            className={cn(
              "mt-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.16em]",
              tone === "dark" ? "text-accent-300" : "text-plp-500",
            )}
          >
            {/* PLP's own tagline */}
            Youth For Change
          </span>
        )}
      </span>
    </span>
  );
}
