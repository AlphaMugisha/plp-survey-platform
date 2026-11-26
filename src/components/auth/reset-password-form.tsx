"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Check, CheckCircle2, Eye, EyeOff, KeyRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import {
  PASSWORD_RULES,
  passwordStrength,
  resetPasswordSchema,
  type ResetPasswordValues,
} from "@/lib/auth/password";
import { cn } from "@/lib/utils";



/* ------------------------------------------------------------------ */

export function ResetPasswordForm({
  canReset,
  linkError,
}: {
  /** True when the recovery link produced a valid session. */
  canReset: boolean;
  /** Error code forwarded by /auth/confirm, if the link failed. */
  linkError?: string;
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const [reveal, setReveal] = React.useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirm: "" },
    mode: "onChange",
  });

  const password = watch("password") ?? "";
  const met = passwordStrength(password);

  async function onSubmit(values: ResetPasswordValues) {
    setError(null);
    const supabase = createClient();

    const { error: updateError } = await supabase.auth.updateUser({
      password: values.password,
    });

    if (updateError) {
      if (/session|expired|jwt/i.test(updateError.message)) {
        setError("Your reset link has expired. Request a new one and try again.");
      } else if (/different from the old|should be different/i.test(updateError.message)) {
        setError("That is already your current password. Choose a different one.");
      } else if (/weak|short|password/i.test(updateError.message)) {
        setError(updateError.message);
      } else {
        setError("We could not update your password. Please try again.");
      }
      return;
    }

    // Any other device still holding a session should be logged out — a reset
    // usually means the old password is no longer trusted.
    await supabase.auth.signOut({ scope: "others" }).catch(() => {});

    setDone(true);
    router.refresh();
  }

  /* ---------------- Link did not work ---------------- */

  if (!canReset) {
    const message =
      linkError === "expired"
        ? "That reset link has expired. Links are valid for one hour and can only be used once."
        : linkError === "not_configured"
          ? "This deployment is not connected to Supabase yet, so password resets cannot be processed."
          : "That reset link is not valid. It may already have been used, or it was altered in transit.";

    return (
      <div>
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive-soft p-4 sm:p-5"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
          <p className="text-[0.9375rem] leading-relaxed text-destructive">{message}</p>
        </div>

        <div className="mt-7 flex flex-col gap-2.5">
          <Button asChild size="lg">
            <Link href="/auth/forgot-password">Request a new link</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/admin/login">Back to sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  /* ---------------- Success ---------------- */

  if (done) {
    return (
      <div>
        <div className="flex items-start gap-3 rounded-2xl border border-success/25 bg-success-soft p-4 sm:p-5">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
          <div>
            <p className="text-[0.9375rem] font-medium text-plp-800">Password updated</p>
            <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-soft">
              You are signed in on this device. Any other device that was signed in has been
              signed out.
            </p>
          </div>
        </div>

        <Button asChild size="lg" className="mt-7 w-full">
          <Link href="/admin">Go to the dashboard</Link>
        </Button>
      </div>
    );
  }

  /* ---------------- Reset form ---------------- */

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
        <Label htmlFor="new-password">New password</Label>
        <div className="relative">
          <Input
            id="new-password"
            type={reveal ? "text" : "password"}
            autoComplete="new-password"
            autoFocus
            placeholder="••••••••••••"
            className="pr-12"
            invalid={Boolean(errors.password)}
            aria-describedby="password-rules"
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            aria-label={reveal ? "Hide password" : "Show password"}
            className="absolute right-1.5 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-plp-50 hover:text-plp-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plp-500"
          >
            {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>

        {/* Strength meter — four segments, one per rule */}
        <div className="flex gap-1.5 pt-1" aria-hidden="true">
          {PASSWORD_RULES.map((rule, i) => (
            <span
              key={rule.id}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors duration-300",
                i < met
                  ? met <= 2
                    ? "bg-destructive/60"
                    : met === 3
                      ? "bg-accent-400"
                      : "bg-success"
                  : "bg-border",
              )}
            />
          ))}
        </div>

        <ul id="password-rules" className="grid gap-1.5 pt-1.5 sm:grid-cols-2">
          {PASSWORD_RULES.map((rule) => {
            const ok = rule.test(password);
            return (
              <li
                key={rule.id}
                className={cn(
                  "flex items-center gap-1.5 text-[0.75rem] transition-colors duration-200",
                  ok ? "text-success" : "text-ink-muted",
                )}
              >
                {ok ? (
                  <Check className="size-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <X className="size-3.5 shrink-0 text-ink-faint" aria-hidden="true" />
                )}
                {rule.label}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          type={reveal ? "text" : "password"}
          autoComplete="new-password"
          placeholder="••••••••••••"
          invalid={Boolean(errors.confirm)}
          aria-describedby={errors.confirm ? "confirm-error" : undefined}
          {...register("confirm")}
        />
        {errors.confirm && (
          <p id="confirm-error" role="alert" className="text-[0.8125rem] text-destructive">
            {errors.confirm.message}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
        {isSubmitting ? "Updating…" : "Set new password"}
        {!isSubmitting && <KeyRound aria-hidden="true" />}
      </Button>
    </form>
  );
}
