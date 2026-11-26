import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium",
    "transition-all duration-300 ease-premium",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plp-500 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-45",
    "[&_svg]:shrink-0",
    "active:translate-y-px",
  ].join(" "),
  {
    variants: {
      variant: {
        /* PLP blue, lifted — the primary call to action */
        primary: [
          "bg-plp-700 text-paper-warm shadow-button",
          "hover:bg-plp-600 hover:shadow-raised hover:-translate-y-0.5",
          "active:bg-plp-800",
        ].join(" "),
        /* White on the dark navy panel — the highest-contrast call to action we
           have, used for the single "start the survey" button. */
        hero: [
          "bg-white text-plp-800 shadow-glow-white font-semibold",
          "hover:bg-accent-100 hover:-translate-y-0.5 hover:shadow-float",
        ].join(" "),
        /* Light accent — reserved for the single most important action on a page */
        accent: [
          "bg-accent-sheen text-plp-900 shadow-button font-semibold",
          "hover:shadow-glow-accent hover:-translate-y-0.5",
        ].join(" "),
        /* Quiet bordered button for secondary paths */
        outline: [
          "border border-plp-700/20 bg-surface text-plp-700 shadow-subtle",
          "hover:border-plp-700/35 hover:bg-plp-50 hover:shadow-card",
        ].join(" "),
        /* On deep navy panels */
        onDark: [
          "border border-paper/25 bg-paper/10 text-paper-warm backdrop-blur-sm",
          "hover:border-paper/40 hover:bg-paper/20",
        ].join(" "),
        subtle: ["bg-plp-50 text-plp-700", "hover:bg-plp-100"].join(" "),
        ghost: ["text-ink-soft", "hover:bg-plp-50 hover:text-plp-700"].join(" "),
        destructive: [
          "bg-destructive text-destructive-foreground shadow-button",
          "hover:bg-destructive/90 hover:shadow-raised",
        ].join(" "),
        link: "text-plp-700 underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 rounded-xl px-3.5 text-sm [&_svg]:size-4",
        md: "h-11 rounded-xl px-5 text-[0.9375rem] [&_svg]:size-4",
        lg: "h-13 rounded-2xl px-7 text-base [&_svg]:size-[1.125rem]",
        xl: "h-14 rounded-2xl px-8 text-[1.0625rem] [&_svg]:size-5",
        hero: "h-16 rounded-2xl px-9 text-[1.125rem] [&_svg]:size-5",
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
