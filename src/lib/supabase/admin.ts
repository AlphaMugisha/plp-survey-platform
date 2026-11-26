import "server-only";

import { createClient } from "@supabase/supabase-js";
import {
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
  isServiceRoleConfigured,
} from "./config";

/**
 * Service-role Supabase client — BYPASSES RLS.
 *
 * `import "server-only"` makes it a build error to pull this into a Client
 * Component, so the service-role key can never reach the browser bundle.
 *
 * Used only to insert a validated submission (participants have no direct
 * write access at all) and to read aggregate data the dashboard needs.
 */
export function createAdminClient() {
  if (!isServiceRoleConfigured()) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured — the server cannot write submissions.",
    );
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { "X-Client-Info": "plp-survey-platform/server" },
    },
  });
}
