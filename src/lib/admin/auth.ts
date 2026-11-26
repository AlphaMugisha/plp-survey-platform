import "server-only";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { AdminProfileRow } from "@/lib/supabase/types";

export type AdminSession = {
  userId: string;
  email: string;
  profile: AdminProfileRow;
  canManage: boolean;
};

/**
 * Resolve the current administrator, or null.
 *
 * Being signed in is NOT enough: the user must also have an active row in
 * admin_profiles. A signed-in user without one has no more access than an
 * anonymous visitor (RLS enforces the same thing at the database level).
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("admin_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) return null;

  const row = profile as AdminProfileRow;

  return {
    userId: user.id,
    email: user.email ?? row.email,
    profile: row,
    canManage: row.role === "owner" || row.role === "admin",
  };
}

/**
 * Require an administrator. Redirects to the sign-in page otherwise.
 * `reason=denied` distinguishes "signed in but not an administrator" from
 * "not signed in", so the sign-in page can explain what happened.
 */
export async function requireAdmin(): Promise<AdminSession> {
  if (!isSupabaseConfigured()) {
    redirect("/admin/login");
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const session = await getAdminSession();
  if (!session) redirect("/admin/login?reason=denied");

  return session;
}

/** Require a role that may change data (owner/admin). */
export async function requireManager(): Promise<AdminSession> {
  const session = await requireAdmin();
  if (!session.canManage) redirect("/admin?reason=readonly");
  return session;
}
