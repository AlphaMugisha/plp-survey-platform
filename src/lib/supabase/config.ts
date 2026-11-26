/**
 * Supabase environment configuration.
 *
 * The app is designed to build and boot WITHOUT credentials so the participant
 * UI and the content-verification tooling can be developed and reviewed offline.
 * Anything that needs the database checks `isSupabaseConfigured()` first and
 * surfaces an explicit "not configured" state rather than pretending to work.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

/** Server-only. Never import this into a Client Component. */
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

/** Optional salt for hashing submission IPs. Without it, no IP hash is stored. */
export const IP_HASH_SALT = process.env.IP_HASH_SALT?.trim() ?? "";

/** True when the public (browser-safe) credentials are present. */
export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}

/** True when the server can write submissions (service-role key present). */
export function isServiceRoleConfigured(): boolean {
  return isSupabaseConfigured() && SUPABASE_SERVICE_ROLE_KEY.length > 0;
}

/** Human-readable list of what is missing, for the setup notice. */
export function missingSupabaseEnv(): string[] {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!SUPABASE_ANON_KEY) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return missing;
}

export function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      `Supabase is not configured. Missing: ${missingSupabaseEnv().join(", ")}. ` +
        "Copy .env.example to .env.local and fill in your project credentials.",
    );
  }
}
