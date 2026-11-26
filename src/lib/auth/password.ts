import { z } from "zod";

/**
 * Password rules for staff accounts.
 *
 * Kept here rather than inside the form so the same definition drives the live
 * checklist, the submit-time validation and the tests. Supabase enforces its
 * own project minimum on top of this; these are the stricter of the two.
 */

export const PASSWORD_RULES = [
  { id: "length", label: "At least 10 characters", test: (v: string) => v.length >= 10 },
  { id: "letter", label: "A letter", test: (v: string) => /\p{L}/u.test(v) },
  { id: "number", label: "A number", test: (v: string) => /\d/u.test(v) },
  {
    id: "symbol",
    label: "A symbol or punctuation mark",
    test: (v: string) => /[^\p{L}\d\s]/u.test(v),
  },
] as const;

export type PasswordRule = (typeof PASSWORD_RULES)[number];

/** How many rules the given password satisfies (0..4). */
export function passwordStrength(value: string): number {
  return PASSWORD_RULES.filter((rule) => rule.test(value)).length;
}

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .refine((v) => /\p{L}/u.test(v), "Include at least one letter.")
  .refine((v) => /\d/u.test(v), "Include at least one number.")
  .refine((v) => /[^\p{L}\d\s]/u.test(v), "Include at least one symbol.");

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string().min(1, "Re-enter the password."),
  })
  .refine((v) => v.password === v.confirm, {
    message: "The two passwords do not match.",
    path: ["confirm"],
  });

export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

/**
 * Only ever redirect within this site.
 * Exported so the open-redirect guard used by /auth/confirm is testable.
 */
export function safeRedirectPath(raw: string | null, fallback = "/auth/reset-password"): string {
  if (!raw) return fallback;
  // Reject absolute URLs and protocol-relative paths outright.
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  // Reject anything with a backslash, which some parsers normalise to "/".
  if (raw.includes("\\")) return fallback;
  return raw;
}
