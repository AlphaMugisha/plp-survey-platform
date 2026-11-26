import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldAlert, ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/admin/login-form";
import { Logo } from "@/components/brand/logo";
import { SetupNotice } from "@/components/site/setup-notice";
import { getAdminSession } from "@/lib/admin/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Staff sign in",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;

  // Already an administrator? Go straight through.
  const session = await getAdminSession();
  if (session) redirect("/admin");

  const configured = isSupabaseConfigured();

  return (
    <main
      id="main"
      className="flex min-h-dvh items-center justify-center bg-canvas px-5 py-14"
    >

      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-7 inline-flex items-center gap-1.5 rounded-xl text-[0.8125rem] font-medium text-ink-muted transition-colors hover:text-plp-700"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to the survey
        </Link>

        <div className="card-lux p-7 sm:p-8">
          <Logo className="mb-7" />

          <div className="mb-1 flex items-center gap-2">
            <ShieldCheck className="size-[1.125rem] text-plp-600" aria-hidden="true" />
            <h1 className="font-display text-[1.5rem] font-semibold tracking-tight text-plp-800">
              Staff sign in
            </h1>
          </div>
          <p className="mb-7 text-[0.9375rem] leading-relaxed text-ink-muted">
            The PLP dashboard is restricted to programme staff. Accounts are created by invitation
            only.
          </p>

          {reason === "denied" && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-accent-400/40 bg-accent-100/50 p-4">
              <ShieldAlert
                className="mt-0.5 size-5 shrink-0 text-accent-600"
                aria-hidden="true"
              />
              <p className="text-[0.875rem] leading-relaxed text-ink-soft">
                You are signed in, but this account is not authorised for the dashboard. Ask an
                existing owner to grant you access.
              </p>
            </div>
          )}

          {!configured && <SetupNotice context="read" />}

          <LoginForm configured={configured} />
        </div>

        <p className="mt-6 text-center text-[0.8125rem] leading-relaxed text-ink-faint">
          There is no self-service registration. See{" "}
          <code className="font-mono">SETUP.md</code> for how an owner grants access.
        </p>
      </div>
    </main>
  );
}
