import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(
        "flex h-12 w-full rounded-xl border bg-surface px-4 text-[0.9375rem] text-ink",
        "shadow-subtle transition-all duration-200 ease-premium",
        "placeholder:text-ink-faint",
        "hover:border-forest-200",
        "focus:outline-none focus:ring-0",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
        invalid
          ? "border-destructive focus:border-destructive focus:shadow-[0_0_0_3px_rgba(180,52,42,0.12)]"
          : "border-border focus:border-forest-400 focus:shadow-glow-emerald",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
