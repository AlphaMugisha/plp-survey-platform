import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

export function SiteHeader({
  tone = "light",
  className,
}: {
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <header
      className={cn(
        "relative z-20 flex items-center justify-between gap-4 py-5",
        className,
      )}
    >
      <Link
        href="/"
        className="rounded-xl transition-opacity hover:opacity-85"
        aria-label="Peace and Love Proclaimers — home"
      >
        <Logo tone={tone} showTagline />
      </Link>

      <Link
        href="/admin"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[0.8125rem] font-medium",
          "transition-colors duration-200",
          tone === "dark"
            ? "text-cream/65 hover:bg-cream/10 hover:text-cream-warm"
            : "text-ink-muted hover:bg-forest-50 hover:text-forest-700",
        )}
      >
        <ShieldCheck className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">Staff sign in</span>
        <span className="sm:hidden">Staff</span>
      </Link>
    </header>
  );
}
