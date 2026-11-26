import { execFileSync } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";

const ps = (script) =>
  execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

/**
 * Windows: the PostgreSQL of THIS test run, found by its unique data folder (e.g.
 * pathirana-api-test-pg-AbC123), before it is stopped. Null elsewhere or if not found.
 */
function findPostmaster(dir) {
  if (process.platform !== "win32") return null;
  const tag = path.basename(dir).replace(/[^A-Za-z0-9_-]/g, "");
  try {
    const pid = ps(
      "(Get-CimInstance Win32_Process -Filter \"Name='postgres.exe'\" | " +
        `Where-Object { $_.CommandLine -like '*${tag}*' } | Select-Object -First 1).ProcessId`,
    ).trim();
    return /^\d+$/.test(pid) ? Number(pid) : null;
  } catch {
    return null;
  }
}

/**
 * Embedded PostgreSQL can leave "io_worker" children running after stop(). Stop only children of
 * THIS run's postmaster that were started during the run — never another PostgreSQL (e.g. an
 * Admin test run, `npm run db:local` or a preview database), even one using the same binaries.
 */
function stopOrphanedWorkers(postmasterPid, startedAt) {
  if (postmasterPid === null) return;
  try {
    ps(
      "Get-CimInstance Win32_Process -Filter \"Name='postgres.exe'\" | " +
        `Where-Object { ($_.ProcessId -eq ${postmasterPid} -or $_.ParentProcessId -eq ${postmasterPid}) -and ` +
        `$_.CreationDate -ge [datetime]::Parse('${new Date(startedAt).toISOString()}').ToLocalTime() } | ` +
        "ForEach-Object { Stop-Process -Id $_.ProcessId -Force }",
    );
  } catch {
    // Best effort only.
  }
}

export default async function globalTeardown() {
  const ctx = globalThis.__TEST_PG__;
  if (!ctx) return;
  const postmaster = findPostmaster(ctx.dir);
  try {
    await ctx.pg.stop();
  } finally {
    stopOrphanedWorkers(postmaster, ctx.startedAt);
    await rm(ctx.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}
