"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "text-sm font-medium leading-snug text-ink peer-disabled:opacity-60",
      className,
    )}
    {...props}
  />
));
Label.displayName = "Label";

/** The required marker — a gold dot, matching the original form's "*" semantics. */
function RequiredMark({ className }: { className?: string }) {
  return (
    <span
      className={cn("ml-1.5 inline-block align-middle", className)}
      title="Required"
      aria-label="required"
    >
      <span className="inline-block size-1.5 rounded-full bg-accent-400 align-middle" />
    </span>
  );
}

/** The optional marker — quiet, so required fields read as the default. */
function OptionalMark({ className }: { className?: string }) {
  return (
    <span className={cn("ml-2 text-xs font-normal text-ink-faint", className)}>Optional</span>
  );
}

export { Label, RequiredMark, OptionalMark };
