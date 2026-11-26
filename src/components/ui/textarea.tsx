import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, rows = 5, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        "flex w-full resize-y rounded-2xl border bg-surface px-4 py-3.5",
        "text-[0.9375rem] leading-relaxed text-ink",
        "shadow-subtle transition-all duration-200 ease-premium",
        "placeholder:text-ink-faint",
        "hover:border-forest-200",
        "focus:outline-none focus:ring-0",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
        "scroll-slim",
        invalid
          ? "border-destructive focus:border-destructive focus:shadow-[0_0_0_3px_rgba(180,52,42,0.12)]"
          : "border-border focus:border-forest-400 focus:shadow-glow-emerald",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };
