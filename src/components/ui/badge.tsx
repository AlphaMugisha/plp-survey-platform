import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        forest: "border-forest-700/15 bg-forest-50 text-forest-700",
        gold: "border-gold-400/30 bg-gold-100/70 text-gold-600",
        neutral: "border-border bg-muted text-ink-muted",
        success: "border-success/25 bg-success-soft text-success",
        danger: "border-destructive/20 bg-destructive-soft text-destructive",
        onDark: "border-cream/20 bg-cream/10 text-cream-warm backdrop-blur-sm",
        outline: "border-forest-700/20 bg-transparent text-forest-700",
      },
      size: {
        sm: "px-2.5 py-0.5 text-[0.6875rem] [&_svg]:size-3",
        md: "px-3 py-1 text-xs [&_svg]:size-3.5",
        lg: "px-3.5 py-1.5 text-sm [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "forest", size: "md" },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
