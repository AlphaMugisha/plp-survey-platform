/**
 * Administrator authentication.
 *
 * The rule under test: being signed in is NOT enough. Access requires an ACTIVE
 * row in admin_profiles, and the role decides whether the session may change
 * anything.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

let currentUser: { id: string; email: string } | null = null;
let currentProfile: Record<string, unknown> | null = null;
let supabaseConfigured = true;

const redirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});

vi.mock("next/navigation", () => ({ redirect }));

vi.mock("@/lib/supabase/config", () => ({
  isSupabaseConfigured: () => supabaseConfigured,
  isServiceRoleConfigured: () => supabaseConfigured,
  missingSupabaseEnv: () => [],
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  IP_HASH_SALT: "",
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: {
      getUser: async () => ({ data: { user: currentUser } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: currentProfile }),
        }),
      }),
    }),
  }),
}));

const { getAdminSession, requireAdmin, requireManager } = await import("@/lib/admin/auth");

function profile(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "owner@example.org",
    full_name: "Programme Owner",
    role: "owner",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  currentUser = { id: "user-1", email: "owner@example.org" };
  currentProfile = profile();
  supabaseConfigured = true;
  redirect.mockClear();
});

describe("getAdminSession", () => {
  it("returns a session for an active administrator", async () => {
    const session = await getAdminSession();
    expect(session).not.toBeNull();
    expect(session!.email).toBe("owner@example.org");
    expect(session!.profile.role).toBe("owner");
  });

  it("returns null when nobody is signed in", async () => {
    currentUser = null;
    expect(await getAdminSession()).toBeNull();
  });

  it("returns null for a signed-in user with NO admin profile", async () => {
    currentProfile = null;
    expect(await getAdminSession()).toBeNull();
  });

  it("returns null for a DEACTIVATED administrator", async () => {
    currentProfile = profile({ is_active: false });
    expect(await getAdminSession()).toBeNull();
  });

  it("returns null when Supabase is not configured", async () => {
    supabaseConfigured = false;
    expect(await getAdminSession()).toBeNull();
  });
});

describe("role capabilities", () => {
  it("lets an owner manage", async () => {
    currentProfile = profile({ role: "owner" });
    expect((await getAdminSession())!.canManage).toBe(true);
  });

  it("lets an admin manage", async () => {
    currentProfile = profile({ role: "admin" });
    expect((await getAdminSession())!.canManage).toBe(true);
  });

  it("keeps a viewer read-only", async () => {
    currentProfile = profile({ role: "viewer" });
    const session = await getAdminSession();
    expect(session).not.toBeNull();
    expect(session!.canManage).toBe(false);
  });
});

describe("requireAdmin", () => {
  it("passes an active administrator through", async () => {
    await expect(requireAdmin()).resolves.toMatchObject({ userId: "user-1" });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects an anonymous visitor to the sign-in page", async () => {
    currentUser = null;
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/admin/login");
  });

  it("redirects a signed-in non-administrator with a reason", async () => {
    currentProfile = null;
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/admin/login?reason=denied");
  });

  it("redirects when Supabase is not configured rather than crashing", async () => {
    supabaseConfigured = false;
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/admin/login");
  });
});

describe("requireManager", () => {
  it("passes an owner through", async () => {
    await expect(requireManager()).resolves.toMatchObject({ canManage: true });
  });

  it("bounces a viewer away from management pages", async () => {
    currentProfile = profile({ role: "viewer" });
    await expect(requireManager()).rejects.toThrow("REDIRECT:/admin?reason=readonly");
  });
});
