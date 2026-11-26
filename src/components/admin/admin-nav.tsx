"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FileStack, LayoutDashboard, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/responses", label: "Responses", icon: Table2 },
  { href: "/admin/surveys", label: "Surveys", icon: FileStack },
] as const;

export function AdminNav({ orientation = "vertical" }: { orientation?: "vertical" | "horizontal" }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Dashboard sections"
      className={cn(
        orientation === "vertical"
          ? "flex flex-col gap-1"
          : "flex gap-1 overflow-x-panel pb-1",
      )}
    >
      {items.map((item) => {
        const active =
          item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5",
              "text-[0.875rem] font-medium transition-all duration-250 ease-premium",
              active
                ? "bg-paper/15 text-paper-warm"
                : "text-paper/55 hover:bg-paper/10 hover:text-paper-warm",
            )}
          >
            {/* active indicator — a light bar on the leading edge */}
            {active && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute bg-accent-sheen",
                  orientation === "vertical"
                    ? "left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r"
                    : "inset-x-3 bottom-0 h-0.5 rounded-t",
                )}
              />
            )}
            <Icon
              className={cn(
                "size-[1.0625rem] shrink-0 transition-colors",
                active ? "text-accent-300" : "text-paper/45 group-hover:text-paper/70",
              )}
              aria-hidden="true"
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
