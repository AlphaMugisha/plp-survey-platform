"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Submission success animation — a gold seal with a drawn tick and two
 * expanding rings. With reduced motion requested, the seal simply appears:
 * the tick is already drawn and the rings do not pulse.
 */
export function SuccessSeal() {
  const reduce = useReducedMotion();

  return (
    <div className="relative mx-auto flex size-24 items-center justify-center">
      {/* expanding rings */}
      {!reduce &&
        [0, 0.45].map((delay) => (
          <motion.span
            key={delay}
            aria-hidden="true"
            className="absolute inset-0 rounded-full border border-emerald-glow/50"
            initial={{ scale: 0.7, opacity: 0.7 }}
            animate={{ scale: 1.65, opacity: 0 }}
            transition={{
              duration: 2.4,
              delay,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
        ))}

      {/* seal */}
      <motion.div
        className="relative flex size-20 items-center justify-center rounded-full bg-gold-sheen shadow-[0_0_0_1px_rgba(213,168,75,0.6),0_8px_32px_-6px_rgba(213,168,75,0.55)]"
        initial={{ scale: reduce ? 1 : 0.6, opacity: reduce ? 1 : 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          duration: reduce ? 0.2 : 0.6,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <svg viewBox="0 0 32 32" className="size-10" fill="none" aria-hidden="true">
          {/* Drawn with a CSS stroke-dash animation. The global reduced-motion
              rule collapses its duration, and `fill-mode: both` means the tick
              lands fully drawn rather than disappearing. */}
          <path
            d="M8.5 16.5l5 5 10-11"
            stroke="#0D2B21"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-draw-check"
            style={{ strokeDasharray: 48 }}
          />
        </svg>
      </motion.div>

      <span className="sr-only">Survey submitted successfully</span>
    </div>
  );
}
