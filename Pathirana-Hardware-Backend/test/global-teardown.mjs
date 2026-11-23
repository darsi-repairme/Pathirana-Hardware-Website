import { execFileSync } from "node:child_process";
import { rm } from "node:fs/promises";

/**
 * Windows: embedded PostgreSQL can leave "io_worker" children running after
 * stop(). Stop only processes started from THIS repository's embedded test
 * binaries after the test run began — never any other PostgreSQL.
 */
function stopOrphanedWorkers(startedAt) {
  if (process.platform !== "win32") return;
  const script =
    "Get-CimInstance Win32_Process -Filter \"Name='postgres.exe'\" | " +
    "Where-Object { $_.CommandLine -like '*Pathirana-Hardware-Backend/node_modules/@embedded-postgres*' -and " +
    `$_.CreationDate -ge [datetime]::Parse('${new Date(startedAt).toISOString()}').ToLocalTime() } | ` +
    "ForEach-Object { Stop-Process -Id $_.ProcessId -Force }";
  try {
    execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      stdio: "ignore",
    });
  } catch {
    // Best effort only.
  }
}

export default async function globalTeardown() {
  const ctx = globalThis.__TEST_PG__;
  if (!ctx) return;
  try {
    await ctx.pg.stop();
  } finally {
    stopOrphanedWorkers(ctx.startedAt);
    await rm(ctx.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}
