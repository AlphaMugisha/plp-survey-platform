/**
 * Guards against a mixed `.next` directory.
 *
 * `next build` and `next dev` write incompatible artifacts into the same
 * `.next` folder. Switching between them without clearing it produces failures
 * that look nothing like their cause:
 *
 *   - "ENOENT: ... .next/server/vendor-chunks/next.js"
 *   - a page that renders with NO CSS at all, because the stylesheet
 *     referenced by the stale manifest no longer exists
 *
 * This runs before `dev` and before `build`, and clears `.next` only when it
 * holds artifacts from the *other* mode. In the normal case — dev after dev —
 * it does nothing, so the incremental cache is preserved and startup stays
 * fast.
 *
 * Usage: node scripts/guard-next-cache.mjs dev|build
 */
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const mode = process.argv[2] === "build" ? "build" : "dev";
const next = join(process.cwd(), ".next");

if (!existsSync(next)) process.exit(0);

// A production build writes BUILD_ID; dev never does.
const hasProductionBuild = existsSync(join(next, "BUILD_ID"));
// Dev writes its own static subtree.
const hasDevArtifacts = existsSync(join(next, "static", "development"));

const conflicted =
  (mode === "dev" && hasProductionBuild) || (mode === "build" && hasDevArtifacts);

if (conflicted) {
  const from = mode === "dev" ? "a production build" : "a dev session";
  console.log(`\n  .next holds ${from}; clearing it so \`next ${mode}\` starts clean.\n`);
  try {
    rmSync(next, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch (error) {
    console.warn(
      `  Could not remove .next automatically (${error instanceof Error ? error.message : error}).\n` +
        "  Close any running dev server, then delete the .next folder by hand.\n",
    );
  }
}
