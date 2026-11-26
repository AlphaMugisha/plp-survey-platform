import Link from "next/link";
import { LogOut } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { LogoMark } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { getAdminSession } from "@/lib/admin/auth";
import { initialsOf } from "@/lib/utils";

/**
 * The dashboard is per-user and shows identifiable response data, so no part of
 * this segment may be prerendered or cached. Without this, a build performed
 * without credentials can statically prerender these routes.
 */
export const dynamic = "force-dynamic";

/**
 * Admin shell.
 *
 * Visually distinct from the participant experience — a dark forest rail
 * against a cream workspace — while using the same palette, radii, shadows and
 * type scale, so it reads as the same product.
 *
 * The login page renders its own full-screen layout, so this shell only wraps
 * authenticated pages; when there is no session the child page redirects.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();

  // Unauthenticated: render children bare (the login page provides its own chrome).
  if (!session) return <>{children}</>;

  return (
    <div className="min-h-dvh lg:flex">
      {/* ---------- Sidebar (desktop) ---------- */}
      <aside className="relative hidden w-64 shrink-0 overflow-hidden bg-forest-panel lg:flex lg:flex-col">
        <span
          aria-hidden="true"
          className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-cream/15 to-transparent"
        />

        <div className="relative flex h-full flex-col p-5">
          <Link
            href="/admin"
            className="mb-8 flex items-center gap-2.5 rounded-xl transition-opacity hover:opacity-85"
          >
            <LogoMark tone="dark" className="size-7" />
            <span className="flex flex-col leading-none">
              <span className="font-display text-[0.9375rem] font-semibold text-cream-warm">
                PLP Dashboard
              </span>
              <span className="mt-1 text-[0.625rem] font-medium uppercase tracking-[0.14em] text-cream/45">
                Programme staff
              </span>
            </span>
          </Link>

          <AdminNav />

          <div className="mt-auto pt-6">
            <div className="rounded-2xl border border-cream/12 bg-cream/[0.06] p-3.5">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-gold-sheen font-display text-[0.8125rem] font-semibold text-forest-900"
                >
                  {initialsOf(session.profile.full_name ?? session.email)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[0.8125rem] font-medium text-cream-warm">
                    {session.profile.full_name ?? session.email}
                  </p>
                  <p className="truncate text-[0.6875rem] text-cream/50">{session.email}</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <Badge variant="onDark" size="sm" className="capitalize">
                  {session.profile.role}
                </Badge>
                <form action="/auth/signout" method="post">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[0.75rem] font-medium text-cream/60 transition-colors hover:bg-cream/10 hover:text-cream-warm"
                  >
                    <LogOut className="size-3.5" aria-hidden="true" />
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ---------- Mobile top bar ---------- */}
      <div className="relative overflow-hidden bg-forest-panel px-5 py-4 lg:hidden">
        <div className="relative flex items-center justify-between gap-4">
          <Link href="/admin" className="flex items-center gap-2.5">
            <LogoMark tone="dark" className="size-6" />
            <span className="font-display text-[0.9375rem] font-semibold text-cream-warm">
              PLP Dashboard
            </span>
          </Link>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[0.75rem] font-medium text-cream/65 hover:bg-cream/10 hover:text-cream-warm"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
        <div className="relative mt-3">
          <AdminNav orientation="horizontal" />
        </div>
      </div>

      {/* ---------- Workspace ---------- */}
      <main id="main" className="min-w-0 flex-1 bg-canvas">
        <div className="mx-auto max-w-[80rem] px-5 py-8 sm:px-8 sm:py-10">{children}</div>
      </main>
    </div>
  );
}
