import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Set a new password",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  /**
   * /auth/confirm exchanges the emailed token for a recovery session before
   * forwarding here, so the presence of a user is what tells us the link was
   * genuine. Without it we show an explanation rather than a form that cannot
   * possibly work.
   */
  let hasRecoverySession = false;

  if (isSupabaseConfigured() && !error) {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    hasRecoverySession = Boolean(user);
  }

  return (
    <AuthShell
      icon={<KeyRound className="size-[1.125rem] text-plp-600" aria-hidden="true" />}
      title="Set a new password"
      description={
        hasRecoverySession
          ? "Choose a password you do not use anywhere else. You will be signed in straight away."
          : undefined
      }
      backHref="/admin/login"
      backLabel="Back to sign in"
    >
      <ResetPasswordForm canReset={hasRecoverySession} linkError={error} />
    </AuthShell>
  );
}
