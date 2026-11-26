/**
 * Builds a SEPARATE copy of the site into ./out-fixtures with synthetic,
 * clearly-labelled test patterns in the gallery. Used only by Playwright to
 * exercise the lightbox while the real gallery is still empty.
 * The production ./out folder is never touched.
 */
import { spawnSync } from "node:child_process";

const env = {
  ...process.env,
  PH_GALLERY_FIXTURES: "1",
  PH_DIST_DIR: "out-fixtures",
  // Test-only build: allowed without NEXT_PUBLIC_API_URL (see next.config.ts).
  ...(process.env.NEXT_PUBLIC_API_URL ? {} : { PH_ALLOW_NO_API: "1" }),
  NEXT_TELEMETRY_DISABLED: "1",
};

for (const [cmd, args] of [
  ["npx", ["next", "build"]],
  ["node", ["scripts/postbuild.mjs"]],
]) {
  const r = spawnSync(cmd, args, { stdio: "inherit", env, shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
