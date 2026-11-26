/**
 * Password reset: strength rules and the open-redirect guard.
 */
import { describe, expect, it } from "vitest";
import {
  PASSWORD_RULES,
  passwordStrength,
  passwordSchema,
  resetPasswordSchema,
  safeRedirectPath,
} from "@/lib/auth/password";

describe("password rules", () => {
  it("defines four rules, each with a label", () => {
    expect(PASSWORD_RULES).toHaveLength(4);
    for (const rule of PASSWORD_RULES) {
      expect(rule.label.length).toBeGreaterThan(0);
    }
  });

  it("scores strength by how many rules are met", () => {
    expect(passwordStrength("")).toBe(0);
    expect(passwordStrength("abc")).toBe(1); // letter only
    expect(passwordStrength("abcdefghij")).toBe(2); // length + letter
    expect(passwordStrength("abcdefghi1")).toBe(3); // + number
    expect(passwordStrength("abcdefghi1!")).toBe(4); // + symbol
  });
});

describe("passwordSchema", () => {
  it("rejects anything under 10 characters", () => {
    expect(passwordSchema.safeParse("Ab1!xyz").success).toBe(false);
  });

  it("requires a letter, a number and a symbol", () => {
    expect(passwordSchema.safeParse("1234567890!").success).toBe(false); // no letter
    expect(passwordSchema.safeParse("abcdefghij!").success).toBe(false); // no number
    expect(passwordSchema.safeParse("abcdefghij1").success).toBe(false); // no symbol
  });

  it("accepts a password meeting every rule", () => {
    expect(passwordSchema.safeParse("umuganda-2026!").success).toBe(true);
  });

  it("counts non-ASCII letters as letters", () => {
    // Staff names and words in Kinyarwanda or French must not be penalised.
    expect(passwordSchema.safeParse("Imigongo-é9!").success).toBe(true);
  });

  it("reports a useful message rather than a raw type error", () => {
    const result = passwordSchema.safeParse("short");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.message).toBe("Use at least 10 characters.");
    }
  });
});

describe("resetPasswordSchema", () => {
  const good = "umuganda-2026!";

  it("accepts matching passwords", () => {
    expect(resetPasswordSchema.safeParse({ password: good, confirm: good }).success).toBe(true);
  });

  it("rejects a mismatch, and reports it on the confirm field", () => {
    const result = resetPasswordSchema.safeParse({ password: good, confirm: "something-else1!" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("confirm"));
      expect(issue?.message).toBe("The two passwords do not match.");
    }
  });

  it("rejects a weak password even when both fields match", () => {
    expect(resetPasswordSchema.safeParse({ password: "abc", confirm: "abc" }).success).toBe(
      false,
    );
  });
});

describe("safeRedirectPath — open-redirect guard", () => {
  it("allows ordinary in-site paths", () => {
    expect(safeRedirectPath("/auth/reset-password")).toBe("/auth/reset-password");
    expect(safeRedirectPath("/admin")).toBe("/admin");
  });

  it("falls back when nothing is supplied", () => {
    expect(safeRedirectPath(null)).toBe("/auth/reset-password");
    expect(safeRedirectPath("")).toBe("/auth/reset-password");
  });

  it("refuses absolute URLs to another host", () => {
    for (const evil of [
      "https://evil.example",
      "http://evil.example/steal",
      "//evil.example",
      "javascript:alert(1)",
      "data:text/html,<script>",
    ]) {
      expect(safeRedirectPath(evil), evil).toBe("/auth/reset-password");
    }
  });

  it("refuses backslash paths that some parsers normalise to /", () => {
    expect(safeRedirectPath("/\\evil.example")).toBe("/auth/reset-password");
    expect(safeRedirectPath("\\\\evil.example")).toBe("/auth/reset-password");
  });

  it("honours a caller-supplied fallback", () => {
    expect(safeRedirectPath("https://evil.example", "/admin/login")).toBe("/admin/login");
  });
});
