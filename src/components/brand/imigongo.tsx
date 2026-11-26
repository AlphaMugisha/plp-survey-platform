import { cn } from "@/lib/utils";

/**
 * Imigongo-inspired geometric artwork.
 *
 * Imigongo (plural of *umugongo*, Kinyarwanda for "line" or "ridge") is a
 * traditional Rwandan art form from the Eastern Province, attributed to Prince
 * Kakira ka Kimenyi of the Gisaka Kingdom in the 18th century. Its motifs are
 * spirals, zigzags, concentric diamonds and interlocking geometric forms —
 * spirals read as continuity and the cycle of life, diagonal zigzags reference
 * the movement of cattle.
 *
 * The traditional palette is black, white, red and ochre. These compositions
 * keep the GEOMETRY and render it in PLP's own blue, so the artwork belongs to
 * the brand while staying rooted in Rwandan visual language. They are
 * deliberately decorative — not a photograph, and not presented as one.
 *
 * All of it is inline SVG: no image requests, scales to any size, and stays
 * crisp on every screen.
 */

/* ------------------------------------------------------------------ *
 * Tiling pattern
 * ------------------------------------------------------------------ */

export function ImigongoPattern({
  className,
  id = "imigongo",
  scale = 1,
  tone = "dark",
}: {
  className?: string;
  /** Unique per usage — two patterns sharing an id will collide. */
  id?: string;
  scale?: number;
  tone?: "dark" | "light";
}) {
  const c =
    tone === "dark"
      ? { bg: "#0A2741", mid: "#124D7E", hi: "#1D75BD", pop: "#4D94D6", line: "#83B6E5" }
      : { bg: "#EFF6FC", mid: "#B3D3F0", hi: "#83B6E5", pop: "#4D94D6", line: "#124D7E" };

  const size = 96 * scale;

  return (
    <svg className={cn("block size-full", className)} aria-hidden="true" focusable="false">
      <defs>
        <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse">
          <rect width={size} height={size} fill={c.bg} />
          <g transform={`scale(${scale})`}>
            {/* outer diamond, split light/dark across the diagonal */}
            <path d="M48 6 L90 48 L48 90 L6 48 Z" fill={c.mid} />
            <path d="M48 6 L90 48 L48 48 Z" fill={c.hi} />
            <path d="M48 48 L6 48 L48 90 Z" fill={c.hi} />

            {/* nested diamond */}
            <path d="M48 24 L72 48 L48 72 L24 48 Z" fill={c.bg} />
            <path d="M48 24 L72 48 L48 48 Z" fill={c.pop} />

            {/* centre spiral — continuity */}
            <path
              d="M48 40a8 8 0 1 1-8 8"
              fill="none"
              stroke={c.line}
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* corner chevrons — the zigzag band, quartered across the tile */}
            <path
              d="M0 0 L12 12 L0 24 M96 0 L84 12 L96 24 M0 96 L12 84 L0 72 M96 96 L84 84 L96 72"
              fill="none"
              stroke={c.pop}
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Zigzag divider
 * ------------------------------------------------------------------ */

/** A thin imigongo zigzag band, used to separate sections. */
export function ImigongoBand({
  className,
  tone = "light",
}: {
  className?: string;
  tone?: "dark" | "light";
}) {
  const stroke = tone === "dark" ? "#4D94D6" : "#1D75BD";
  const faint = tone === "dark" ? "#124D7E" : "#B3D3F0";

  return (
    /* No viewBox: the pattern tiles at its natural size across any width, so
       the zigzag keeps its angle instead of being stretched into a flat wave. */
    <svg
      className={cn("block h-4 w-full", className)}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern id="imigongo-band" width="32" height="16" patternUnits="userSpaceOnUse">
          <path
            d="M0 16 L8 2 L16 16 L24 2 L32 16"
            fill="none"
            stroke={faint}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M0 16 L8 2 L16 16"
            fill="none"
            stroke={stroke}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#imigongo-band)" />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Hero composition
 * ------------------------------------------------------------------ */

/**
 * A single large imigongo panel, used where a lead image would sit.
 * Composed rather than tiled, so it reads as artwork instead of wallpaper.
 */
export function ImigongoPanel({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 320"
      className={cn("block size-full", className)}
      role="img"
      aria-label="Imigongo-inspired geometric artwork in the PLP brand blue"
    >
      <rect width="400" height="320" fill="#0A2741" />

      {/* zigzag header band */}
      <g stroke="#1D75BD" strokeWidth="3" fill="none">
        <path d="M0 26 L25 4 L50 26 L75 4 L100 26 L125 4 L150 26 L175 4 L200 26 L225 4 L250 26 L275 4 L300 26 L325 4 L350 26 L375 4 L400 26" />
      </g>

      {/* three diamonds — the central motif */}
      {[100, 200, 300].map((cx, i) => (
        <g key={cx}>
          <path
            d={`M${cx} 90 L${cx + 62} 160 L${cx} 230 L${cx - 62} 160 Z`}
            fill={i === 1 ? "#124D7E" : "#0E3A5F"}
          />
          <path d={`M${cx} 90 L${cx + 62} 160 L${cx} 160 Z`} fill="#1D75BD" />
          <path d={`M${cx} 160 L${cx - 62} 160 L${cx} 230 Z`} fill="#1D75BD" />
          <path
            d={`M${cx} 124 L${cx + 36} 160 L${cx} 196 L${cx - 36} 160 Z`}
            fill="#0A2741"
          />
          <path d={`M${cx} 124 L${cx + 36} 160 L${cx} 160 Z`} fill="#4D94D6" />
          {/* spiral at each centre */}
          <path
            d={`M${cx} 148a12 12 0 1 1-12 12`}
            fill="none"
            stroke="#83B6E5"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      ))}

      {/* zigzag footer band */}
      <g stroke="#1D75BD" strokeWidth="3" fill="none">
        <path d="M0 294 L25 316 L50 294 L75 316 L100 294 L125 316 L150 294 L175 316 L200 294 L225 316 L250 294 L275 316 L300 294 L325 316 L350 294 L375 316 L400 294" />
      </g>
    </svg>
  );
}
