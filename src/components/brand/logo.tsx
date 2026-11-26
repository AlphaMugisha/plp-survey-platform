import { cn } from "@/lib/utils";

/**
 * PLP mark — an abstract olive-leaf / open-book form: three leaves rising from a
 * single stem, reading as growth and peace. Drawn as inline SVG so it stays
 * crisp, themeable and dependency-free.
 */
export function LogoMark({
  className,
  tone = "light",
}: {
  className?: string;
  /** "light" = on cream surfaces, "dark" = on forest panels */
  tone?: "light" | "dark";
}) {
  const leaf = tone === "dark" ? "#F7EBCF" : "#123B2D";
  const accent = tone === "dark" ? "#D5A84B" : "#2FA36B";

  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8", className)}
      role="img"
      aria-label="Peace and Love Proclaimers"
      fill="none"
    >
      {/* centre stem */}
      <path
        d="M16 28V11"
        stroke={leaf}
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      {/* upper leaf pair */}
      <path
        d="M16 12.5c0-4.1 2.3-7.4 6-9.1.6 4.3-1.4 8-6 9.1Z"
        fill={leaf}
      />
      <path
        d="M16 12.5c0-4.1-2.3-7.4-6-9.1-.6 4.3 1.4 8 6 9.1Z"
        fill={leaf}
        opacity="0.72"
      />
      {/* lower leaf — the gold/emerald accent */}
      <path
        d="M16 21c0-3.5 2.6-6.1 6.6-6.7.1 3.8-2.5 6.4-6.6 6.7Z"
        fill={accent}
      />
      <circle cx="16" cy="29.2" r="1.5" fill={accent} />
    </svg>
  );
}

/** Full lockup: mark + wordmark. */
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
      <LogoMark tone={tone} className="size-8 shrink-0" />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display text-[1.0625rem] font-semibold tracking-tight",
            tone === "dark" ? "text-cream-warm" : "text-forest-800",
          )}
        >
          Peace &amp; Love Proclaimers
        </span>
        {showTagline && (
          <span
            className={cn(
              "mt-1 text-[0.6875rem] font-medium uppercase tracking-[0.14em]",
              tone === "dark" ? "text-cream/55" : "text-ink-muted",
            )}
          >
            PLP School Curriculum
          </span>
        )}
      </span>
    </span>
  );
}
