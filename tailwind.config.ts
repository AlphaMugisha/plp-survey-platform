import type { Config } from "tailwindcss";

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
        /* ---- PLP brand palette ---- */
        forest: {
          50: "#EEF4F0",
          100: "#D7E6DD",
          200: "#AFCDBB",
          300: "#7FAE93",
          400: "#4E8A6B",
          500: "#2C6A4B",
          600: "#1B513D",
          700: "#123B2D",
          800: "#0D2B21",
          900: "#081C16",
          950: "#04100C",
        },
        emerald: {
          accent: "#2FA36B",
          glow: "#3FD08A",
        },
        gold: {
          100: "#F7EBCF",
          200: "#EDD79F",
          300: "#E0C274",
          400: "#D5A84B",
          500: "#B88C33",
          600: "#8F6A23",
        },
        cream: {
          DEFAULT: "#F7F7F2",
          deep: "#F0F0E7",
          warm: "#FBFAF5",
        },
        ink: {
          DEFAULT: "#19251F",
          soft: "#2E3C34",
          muted: "#77827A",
          faint: "#A4ADA6",
        },

        /* ---- semantic tokens (shadcn-compatible) ---- */
        background: "#F7F7F2",
        foreground: "#19251F",
        border: "#E2E4DC",
        input: "#E2E4DC",
        ring: "#2C6A4B",
        primary: {
          DEFAULT: "#123B2D",
          hover: "#1B513D",
          foreground: "#FBFAF5",
        },
        secondary: {
          DEFAULT: "#EEF4F0",
          foreground: "#123B2D",
        },
        accent: {
          DEFAULT: "#D5A84B",
          foreground: "#19251F",
        },
        muted: {
          DEFAULT: "#F0F0E7",
          foreground: "#77827A",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          sunken: "#F7F7F2",
          raised: "#FFFFFF",
        },
        destructive: {
          DEFAULT: "#B4342A",
          soft: "#FDF2F1",
          foreground: "#FFFFFF",
        },
        success: {
          DEFAULT: "#2FA36B",
          soft: "#EDF8F2",
        },
      },
      spacing: {
        13: "3.25rem",
        15: "3.75rem",
        18: "4.5rem",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1rem",
        "3xl": "1.25rem",
        card: "1.25rem" /* 20px — major surfaces */,
        panel: "1.5rem" /* 24px */,
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      fontSize: {
        "display-sm": ["2.125rem", { lineHeight: "1.12", letterSpacing: "-0.02em" }],
        "display-md": ["2.875rem", { lineHeight: "1.08", letterSpacing: "-0.025em" }],
        "display-lg": ["3.75rem", { lineHeight: "1.03", letterSpacing: "-0.03em" }],
        "display-xl": ["4.75rem", { lineHeight: "1", letterSpacing: "-0.035em" }],
      },
      boxShadow: {
        /* layered, low-opacity greens rather than flat black */
        subtle: "0 1px 2px rgba(18,59,45,0.05), 0 1px 1px rgba(18,59,45,0.04)",
        card: "0 1px 3px rgba(18,59,45,0.06), 0 8px 24px -12px rgba(18,59,45,0.10)",
        raised:
          "0 2px 4px rgba(18,59,45,0.05), 0 12px 32px -8px rgba(18,59,45,0.12), 0 24px 48px -24px rgba(18,59,45,0.10)",
        float:
          "0 4px 8px rgba(18,59,45,0.05), 0 20px 48px -12px rgba(18,59,45,0.16), 0 40px 80px -32px rgba(18,59,45,0.12)",
        "glow-emerald":
          "0 0 0 1px rgba(47,163,107,0.45), 0 0 0 4px rgba(47,163,107,0.12), 0 6px 20px -6px rgba(47,163,107,0.35)",
        "glow-emerald-lg":
          "0 0 0 1px rgba(47,163,107,0.5), 0 0 0 5px rgba(47,163,107,0.14), 0 10px 32px -8px rgba(47,163,107,0.42)",
        "glow-gold":
          "0 0 0 1px rgba(213,168,75,0.5), 0 0 0 4px rgba(213,168,75,0.14), 0 6px 20px -6px rgba(213,168,75,0.32)",
        "inner-light": "inset 0 1px 0 rgba(255,255,255,0.08)",
        button: "0 1px 2px rgba(8,28,22,0.24), inset 0 1px 0 rgba(255,255,255,0.09)",
      },
      backgroundImage: {
        "forest-gradient": "linear-gradient(145deg, #123B2D 0%, #0D2B21 55%, #081C16 100%)",
        "forest-sheen": "linear-gradient(135deg, #1B513D 0%, #123B2D 48%, #0D2B21 100%)",
        "gold-sheen": "linear-gradient(135deg, #E0C274 0%, #D5A84B 50%, #B88C33 100%)",
        "cream-fade": "linear-gradient(180deg, #FBFAF5 0%, #F7F7F2 100%)",
        "grain-dot": "radial-gradient(rgba(18,59,45,0.14) 1px, transparent 1px)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
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
        "draw-check": {
          from: { strokeDashoffset: "48" },
          to: { strokeDashoffset: "0" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
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
      },
      transitionTimingFunction: {
        premium: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      transitionDuration: {
        250: "250ms",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
