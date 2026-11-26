"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, ArrowLeft, MailCheck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address.")
    .email("Enter a valid email address."),
});

type Values = z.infer<typeof schema>;

export function ForgotPasswordForm({ configured }: { configured: boolean }) {
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  async function onSubmit(values: Values) {
    setError(null);

    if (!configured) {
      setError("Supabase is not configured on this deployment yet.");
      return;
    }

    const supabase = createClient();

    // The link in the email lands on /auth/confirm, which verifies the token,
    // establishes a short-lived recovery session and forwards to the reset page.
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/auth/reset-password`,
    });

    if (resetError) {
      // Rate limiting is the one case worth surfacing specifically — otherwise
      // the user retries and is confused by silence.
      setError(
        /rate|too many/i.test(resetError.message)
          ? "Too many attempts. Wait a few minutes and try again."
          : "We could not send the email just now. Please try again shortly.",
      );
      return;
    }

    setSentTo(values.email);
  }

  /* ---------------- Sent ---------------- */

  if (sentTo) {
    return (
      <div>
        <div className="flex items-start gap-3 rounded-2xl border border-success/25 bg-success-soft p-4 sm:p-5">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[0.9375rem] font-medium text-plp-800">Check your inbox</p>
            <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-soft">
              If <strong className="break-words font-medium">{sentTo}</strong> belongs to a staff
              account, a reset link is on its way. The link expires in one hour and can only be
              used once.
            </p>
          </div>
        </div>

        <ul className="mt-6 space-y-2 text-[0.8125rem] leading-relaxed text-ink-muted">
          <li>· Nothing after a few minutes? Check your spam or junk folder.</li>
          <li>· Make sure you used the address PLP created your account with.</li>
        </ul>

        <div className="mt-7 flex flex-col gap-2.5">
          <Button asChild variant="outline" size="lg">
            <Link href="/admin/login">
              <ArrowLeft aria-hidden="true" />
              Back to sign in
            </Link>
          </Button>
          <button
            type="button"
            onClick={() => setSentTo(null)}
            className="rounded-lg py-1.5 text-[0.8125rem] font-medium text-plp-700 transition-colors hover:text-plp-500"
          >
            Use a different email address
          </button>
        </div>
      </div>
    );
  }

  /* ---------------- Request ---------------- */

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive-soft p-4"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
          <p className="text-[0.9375rem] leading-relaxed text-destructive">{error}</p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="reset-email">Email address</Label>
        <Input
          id="reset-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          placeholder="you@example.org"
          invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "reset-email-error" : undefined}
          {...register("email")}
        />
        {errors.email && (
          <p id="reset-email-error" role="alert" className="text-[0.8125rem] text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
        {isSubmitting ? "Sending…" : "Email me a reset link"}
        {!isSubmitting && <Send aria-hidden="true" />}
      </Button>

      <div className="text-center">
        <Link
          href="/admin/login"
          className="inline-flex items-center gap-1.5 rounded-lg py-1 text-[0.8125rem] font-medium text-ink-muted transition-colors hover:text-plp-700"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to sign in
        </Link>
      </div>

      {/* Deliberately vague about whether the address exists. */}
      <p className="text-center text-[0.75rem] leading-relaxed text-ink-faint">
        For security, we send the same confirmation whether or not an account exists for{" "}
        {getValues("email") ? "that address" : "the address you enter"}.
      </p>
    </form>
  );
}
