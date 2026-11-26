import { TriangleAlert } from "lucide-react";
import { missingSupabaseEnv } from "@/lib/supabase/config";

/**
 * Honest configuration state.
 *
 * Shown whenever the database credentials are absent. The survey still renders
 * so content can be reviewed, but we never imply that a submission would be
 * stored when it would not be.
 */
export function SetupNotice({ context = "submit" }: { context?: "submit" | "read" }) {
  const missing = missingSupabaseEnv();
  if (missing.length === 0) return null;

  return (
    <div className="mb-8 rounded-card border border-gold-400/40 bg-gold-100/50 p-5 sm:p-6">
      <div className="flex items-start gap-3.5">
        <span
          className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-gold-400/20 text-gold-600"
          aria-hidden="true"
        >
          <TriangleAlert className="size-[1.125rem]" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-[1.0625rem] font-semibold text-forest-800">
            Database not configured
          </p>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">
            {context === "submit"
              ? "The survey below is fully rendered from the verified source file, but submissions cannot be saved yet."
              : "Dashboard data cannot be loaded yet."}{" "}
            Add the following to <code className="rounded bg-forest-50 px-1.5 py-0.5 text-[0.8125rem] text-forest-700">.env.local</code>:
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {missing.map((key) => (
              <li
                key={key}
                className="rounded-lg border border-gold-400/35 bg-surface px-2.5 py-1 font-mono text-[0.75rem] text-forest-700"
              >
                {key}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-muted">
            See <code className="font-mono">SETUP.md</code> for the full setup steps.
          </p>
        </div>
      </div>
    </div>
  );
}
