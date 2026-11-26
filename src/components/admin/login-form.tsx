"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Enter your email address.").email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setError(null);

    if (!configured) {
      setError("Supabase is not configured on this deployment yet.");
      return;
    }

    const supabase = createClient();

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (signInError || !data.user) {
      // Deliberately generic: do not reveal whether the address exists.
      setError("Those sign-in details were not recognised.");
      return;
    }

    // Signing in is not the same as being an administrator — the account must
    // also have an active admin profile. If it does not, end the session.
    const { data: profile } = await supabase
      .from("admin_profiles")
      .select("id, is_active")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!profile || !profile.is_active) {
      await supabase.auth.signOut();
      setError(
        "This account is not authorised for the PLP dashboard. Ask an existing owner to grant access.",
      );
      return;
    }

    router.push("/admin");
    router.refresh();
  }

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
        <Label htmlFor="admin-email">Email address</Label>
        <Input
          id="admin-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.org"
          invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "admin-email-error" : undefined}
          {...register("email")}
        />
        {errors.email && (
          <p id="admin-email-error" role="alert" className="text-[0.8125rem] text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="admin-password">Password</Label>
        <Input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••••••"
          invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "admin-password-error" : undefined}
          {...register("password")}
        />
        {errors.password && (
          <p id="admin-password-error" role="alert" className="text-[0.8125rem] text-destructive">
            {errors.password.message}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
        {isSubmitting ? "Signing in…" : "Sign in"}
        {!isSubmitting && <LogIn aria-hidden="true" />}
      </Button>
    </form>
  );
}
