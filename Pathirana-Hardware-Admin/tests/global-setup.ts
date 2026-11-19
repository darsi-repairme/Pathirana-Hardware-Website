import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ADMIN_PORT, STAFF, startStack, stopStack } from "./stack";

export const AUTH_DIR = path.resolve(__dirname, ".auth");

/** Signs in through the real admin login route and saves the HttpOnly session cookie for the tests. */
async function saveSession(name: "admin" | "editor", ip: string) {
  const origin = `http://127.0.0.1:${ADMIN_PORT}`;
  const res = await fetch(`${origin}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin, "x-ph-admin": "1", "X-Forwarded-For": ip },
    body: JSON.stringify({ email: STAFF[name].email, password: STAFF[name].password }),
  });
  if (!res.ok) throw new Error(`Sign-in for ${name} failed: ${res.status}`);
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith("ph_admin_session="))!;
  const value = cookie.split(";")[0]!.split("=").slice(1).join("=");
  await writeFile(
    path.join(AUTH_DIR, `${name}.json`),
    JSON.stringify({
      cookies: [
        {
          name: "ph_admin_session",
          value,
          domain: "127.0.0.1",
          path: "/",
          expires: -1,
          httpOnly: true,
          secure: false,
          sameSite: "Strict",
        },
      ],
      origins: [],
    }),
  );
}

/** Starts the isolated stack once for all admin tests; returns the teardown. */
export default async function globalSetup() {
  const stack = await startStack();
  process.env.E2E_DB_URL = stack.dbUrl;
  await mkdir(AUTH_DIR, { recursive: true });
  await saveSession("admin", "10.10.0.1");
  await saveSession("editor", "10.10.0.2");
  return async () => {
    await stopStack(stack);
    // Windows: embedded PostgreSQL can leave io_worker children; stop only this repo's test binaries.
    if (process.platform === "win32") {
      const { execFileSync } = await import("node:child_process");
      try {
        execFileSync(
          "powershell.exe",
          [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Get-CimInstance Win32_Process -Filter \"Name='postgres.exe'\" | Where-Object { $_.CommandLine -like '*Pathirana-Hardware-Backend/node_modules/@embedded-postgres*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }",
          ],
          { stdio: "ignore" },
        );
      } catch {}
    }
  };
}
