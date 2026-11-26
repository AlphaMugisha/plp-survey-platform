import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        brand: "border-plp-700/15 bg-plp-50 text-plp-700",
        accent: "border-accent-400/30 bg-accent-100/70 text-accent-600",
        neutral: "border-border bg-muted text-ink-muted",
        success: "border-success/25 bg-success-soft text-success",
        danger: "border-destructive/20 bg-destructive-soft text-destructive",
        onDark: "border-paper/20 bg-paper/10 text-paper-warm backdrop-blur-sm",
        outline: "border-plp-700/20 bg-transparent text-plp-700",
      },
      size: {
        sm: "px-2.5 py-0.5 text-[0.6875rem] [&_svg]:size-3",
        md: "px-3 py-1 text-xs [&_svg]:size-3.5",
        lg: "px-3.5 py-1.5 text-sm [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "brand", size: "md" },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
