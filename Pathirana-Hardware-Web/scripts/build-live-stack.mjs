/**
 * Builds a SEPARATE copy of the site into ./out-live, wired to the isolated
 * test API that tests/live-stack starts (http://127.0.0.1:4320). Used only by
 * `npm run test:live-stack`. The production ./out folder is never touched.
 */
import { spawnSync } from "node:child_process";
import { LIVE_API_PORT } from "../tests/live-stack/ports.mjs";

const env = {
  ...process.env,
  PH_DIST_DIR: "out-live",
  NEXT_PUBLIC_API_URL: `http://127.0.0.1:${LIVE_API_PORT}`,
  NEXT_TELEMETRY_DISABLED: "1",
};

for (const [cmd, args] of [
  ["npx", ["next", "build"]],
  ["node", ["scripts/postbuild.mjs"]],
]) {
  const r = spawnSync(cmd, args, { stdio: "inherit", env, shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
