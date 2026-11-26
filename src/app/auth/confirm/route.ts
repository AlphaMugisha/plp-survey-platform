import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { safeRedirectPath } from "@/lib/auth/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Landing point for links sent by Supabase Auth (password recovery, invites).
 *
 * Supabase sends one of two shapes depending on the project's email template
 * and flow, so both are handled:
 *
 *   ?code=...                      PKCE — exchange it for a session
 *   ?token_hash=...&type=recovery  OTP  — verify it for a session
 *
 * On success the user holds a short-lived recovery session and is forwarded to
 * `next` (the reset form). On failure they go to the reset page with an error
 * code, so the page can explain what happened instead of showing a dead form.
 */

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeRedirectPath(searchParams.get("next"));

  const fail = (reason: string) =>
    NextResponse.redirect(`${origin}${next}?error=${encodeURIComponent(reason)}`);

  if (!isSupabaseConfigured()) return fail("not_configured");

  // Supabase reports its own problems (expired/already-used links) on the URL.
  const providerError = searchParams.get("error_description") ?? searchParams.get("error");
  if (providerError) {
    return fail(/expired/i.test(providerError) ? "expired" : "invalid");
  }

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createServerSupabase();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return fail(/expired/i.test(error.message) ? "expired" : "invalid");
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) {
      return fail(/expired/i.test(error.message) ? "expired" : "invalid");
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  return fail("missing");
}
