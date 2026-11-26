import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium",
    "transition-all duration-300 ease-premium",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-500 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-45",
    "[&_svg]:shrink-0",
    "active:translate-y-px",
  ].join(" "),
  {
    variants: {
      variant: {
        /* Deep forest, lifted — the primary call to action */
        primary: [
          "bg-forest-700 text-cream-warm shadow-button",
          "hover:bg-forest-600 hover:shadow-raised hover:-translate-y-0.5",
          "active:bg-forest-800",
        ].join(" "),
        /* Gold — reserved for the single most important action on a page */
        accent: [
          "bg-gold-sheen text-forest-900 shadow-button",
          "hover:shadow-glow-gold hover:-translate-y-0.5",
        ].join(" "),
        /* Quiet bordered button for secondary paths */
        outline: [
          "border border-forest-700/20 bg-surface text-forest-700 shadow-subtle",
          "hover:border-forest-700/35 hover:bg-forest-50 hover:shadow-card",
        ].join(" "),
        /* On dark forest panels */
        onDark: [
          "border border-cream/25 bg-cream/10 text-cream-warm backdrop-blur-sm",
          "hover:border-cream/40 hover:bg-cream/20",
        ].join(" "),
        subtle: ["bg-forest-50 text-forest-700", "hover:bg-forest-100"].join(" "),
        ghost: ["text-ink-soft", "hover:bg-forest-50 hover:text-forest-700"].join(" "),
        destructive: [
          "bg-destructive text-destructive-foreground shadow-button",
          "hover:bg-destructive/90 hover:shadow-raised",
        ].join(" "),
        link: "text-forest-700 underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 rounded-xl px-3.5 text-sm [&_svg]:size-4",
        md: "h-11 rounded-xl px-5 text-[0.9375rem] [&_svg]:size-4",
        lg: "h-13 rounded-2xl px-7 text-base [&_svg]:size-[1.125rem]",
        xl: "h-14 rounded-2xl px-8 text-[1.0625rem] [&_svg]:size-5",
        icon: "size-10 rounded-xl [&_svg]:size-[1.125rem]",
        iconSm: "size-9 rounded-lg [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading = false, disabled, children, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" />
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
