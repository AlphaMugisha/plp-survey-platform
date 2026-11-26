import type { Config } from "tailwindcss";

/**
 * PLP design tokens.
 *
 * Built on the Peace and Love Proclaimers brand palette:
 *   Denim      #1D75BD   the brand blue, and the base of the `plp` scale
 *   White      #FFFFFF   surfaces
 *   Black Russian #000004 the deepest end of the dark panels
 *
 * The brand is deliberately blue / white / black, so hierarchy is carried by
 * VALUE (lightness) rather than by introducing off-brand hues. The one
 * exception is the chart ramp in src/lib/charts/palette.ts, where a warm pole
 * is needed to encode disagreement — that is a data encoding, not brand colour.
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1.25rem", sm: "2rem", lg: "2.5rem" },
      screens: { "2xl": "1360px" },
    },
    extend: {
      colors: {
        /* ---- PLP Denim blue ---- */
        plp: {
          50: "#EFF6FC",
          100: "#D8E9F8",
          200: "#B3D3F0",
          300: "#83B6E5",
          400: "#4D94D6",
          500: "#1D75BD" /* brand Denim */,
          600: "#17619E",
          700: "#124D7E",
          800: "#0E3A5F",
          900: "#0A2741",
          950: "#04121F",
          accent: "#4D94D6",
          glow: "#83B6E5",
        },

        /* ---- Lighter blue, for accents on dark panels ---- */
        accent: {
          100: "#E6F2FB",
          200: "#C2E0F6",
          300: "#8FC6EE",
          400: "#5BA8E0",
          500: "#2E89CC",
          600: "#1E6AA3",
          DEFAULT: "#5BA8E0",
          foreground: "#04121F",
        },

        /* ---- Surfaces ---- */
        paper: {
          DEFAULT: "#F6F9FC",
          warm: "#FFFFFF",
          deep: "#EAF1F8",
        },

        /* ---- Cool neutral text ---- */
        ink: {
          DEFAULT: "#0A1A2B",
          soft: "#28394B",
          muted: "#5E7083",
          faint: "#93A3B3",
        },

        /* ---- Semantic tokens ---- */
        background: "#F6F9FC",
        foreground: "#0A1A2B",
        border: "#DCE6F0",
        input: "#DCE6F0",
        ring: "#1D75BD",
        primary: {
          DEFAULT: "#1D75BD",
          hover: "#17619E",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#EFF6FC",
          foreground: "#124D7E",
        },
        muted: {
          DEFAULT: "#EAF1F8",
          foreground: "#5E7083",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          sunken: "#F6F9FC",
          raised: "#FFFFFF",
        },
        destructive: {
          DEFAULT: "#C23934",
          soft: "#FDF3F2",
          foreground: "#FFFFFF",
        },
        success: {
          DEFAULT: "#1E8E5A",
          soft: "#ECF7F1",
        },
      },
      spacing: { 13: "3.25rem", 15: "3.75rem", 18: "4.5rem" },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1rem",
        "3xl": "1.25rem",
        card: "1.25rem",
        panel: "1.5rem",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        "display-sm": ["2.125rem", { lineHeight: "1.12", letterSpacing: "-0.025em" }],
        "display-md": ["2.875rem", { lineHeight: "1.06", letterSpacing: "-0.03em" }],
        "display-lg": ["3.75rem", { lineHeight: "1.02", letterSpacing: "-0.035em" }],
        "display-xl": ["4.75rem", { lineHeight: "0.98", letterSpacing: "-0.04em" }],
      },
      boxShadow: {
        subtle: "0 1px 2px rgba(10,39,65,0.05), 0 1px 1px rgba(10,39,65,0.04)",
        card: "0 1px 3px rgba(10,39,65,0.07), 0 8px 24px -12px rgba(10,39,65,0.12)",
        raised:
          "0 2px 4px rgba(10,39,65,0.06), 0 12px 32px -8px rgba(10,39,65,0.14), 0 24px 48px -24px rgba(10,39,65,0.12)",
        float:
          "0 4px 8px rgba(10,39,65,0.06), 0 20px 48px -12px rgba(10,39,65,0.18), 0 40px 80px -32px rgba(10,39,65,0.14)",
        "glow-brand":
          "0 0 0 1px rgba(29,117,189,0.45), 0 0 0 4px rgba(29,117,189,0.12), 0 6px 20px -6px rgba(29,117,189,0.35)",
        "glow-brand-lg":
          "0 0 0 1px rgba(29,117,189,0.5), 0 0 0 5px rgba(29,117,189,0.14), 0 10px 32px -8px rgba(29,117,189,0.42)",
        "glow-accent":
          "0 0 0 1px rgba(91,168,224,0.5), 0 0 0 4px rgba(91,168,224,0.16), 0 6px 20px -6px rgba(91,168,224,0.35)",
        "glow-white":
          "0 0 0 1px rgba(255,255,255,0.35), 0 0 0 6px rgba(255,255,255,0.10), 0 12px 32px -8px rgba(4,18,31,0.45)",
        "inner-light": "inset 0 1px 0 rgba(255,255,255,0.10)",
        button: "0 1px 2px rgba(4,18,31,0.22), inset 0 1px 0 rgba(255,255,255,0.10)",
      },
      backgroundImage: {
        "plp-gradient": "linear-gradient(145deg, #1D75BD 0%, #0E3A5F 55%, #04121F 100%)",
        "plp-sheen": "linear-gradient(135deg, #2E89CC 0%, #1D75BD 48%, #124D7E 100%)",
        "accent-sheen": "linear-gradient(135deg, #C2E0F6 0%, #8FC6EE 50%, #5BA8E0 100%)",
        "paper-fade": "linear-gradient(180deg, #FFFFFF 0%, #F6F9FC 100%)",
        "grain-dot": "radial-gradient(rgba(10,39,65,0.14) 1px, transparent 1px)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.45" },
          "50%": { opacity: "0.85" },
        },
        "aurora-drift": {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(2%, -3%, 0) scale(1.06)" },
        },
        "draw-check": { from: { strokeDashoffset: "48" }, to: { strokeDashoffset: "0" } },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
        "nudge-down": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(5px)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both",
        "fade-in": "fade-in 0.4s ease-out both",
        "scale-in": "scale-in 0.35s cubic-bezier(0.22,1,0.36,1) both",
        "pulse-glow": "pulse-glow 5s ease-in-out infinite",
        "aurora-drift": "aurora-drift 18s ease-in-out infinite",
        "draw-check": "draw-check 0.6s cubic-bezier(0.65,0,0.35,1) 0.2s both",
        shimmer: "shimmer 2s linear infinite",
        "nudge-down": "nudge-down 2.2s ease-in-out infinite",
      },
      transitionTimingFunction: { premium: "cubic-bezier(0.22, 1, 0.36, 1)" },
      transitionDuration: { 250: "250ms" },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
