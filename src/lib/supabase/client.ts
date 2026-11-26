"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

/**
 * Browser Supabase client (anon key only).
 *
 * The anon key is public by design and is gated by RLS: it can read active
 * survey content and nothing else. It can never read or write responses.
 */
export function createClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured — NEXT_PUBLIC_SUPABASE_* env vars are missing.");
  }
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
