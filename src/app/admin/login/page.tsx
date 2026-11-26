import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
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
    <AuthShell
      icon={<ShieldCheck className="size-[1.125rem] text-plp-600" aria-hidden="true" />}
      title="Staff sign in"
      description="The PLP dashboard is restricted to programme staff. Accounts are created by invitation only."
      footer={
        <>
          There is no self-service registration. See <code className="font-mono">SETUP.md</code>{" "}
          for how an owner grants access.
        </>
      }
    >
      {reason === "denied" && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-accent-400/40 bg-accent-100/50 p-4">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-accent-600" aria-hidden="true" />
          <p className="text-[0.875rem] leading-relaxed text-ink-soft">
            You are signed in, but this account is not authorised for the dashboard. Ask an
            existing owner to grant you access.
          </p>
        </div>
      )}

      {!configured && <SetupNotice context="read" />}

      <LoginForm configured={configured} />
    </AuthShell>
  );
}
