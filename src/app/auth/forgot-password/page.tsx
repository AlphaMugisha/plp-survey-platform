import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { SetupNotice } from "@/components/site/setup-notice";
import { getAdminSession } from "@/lib/admin/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  // Already signed in? Nothing to recover.
  const session = await getAdminSession();
  if (session) redirect("/admin");

  const configured = isSupabaseConfigured();

  return (
    <AuthShell
      icon={<KeyRound className="size-[1.125rem] text-plp-600" aria-hidden="true" />}
      title="Reset your password"
      description="Enter the email address PLP created your staff account with, and we will send you a link to set a new password."
      backHref="/admin/login"
      backLabel="Back to sign in"
      footer={
        <>
          Reset links expire after one hour and can be used once. If you no longer have access to
          that inbox, ask an owner to update your account.
        </>
      }
    >
      {!configured && <SetupNotice context="read" />}
      <ForgotPasswordForm configured={configured} />
    </AuthShell>
  );
}
