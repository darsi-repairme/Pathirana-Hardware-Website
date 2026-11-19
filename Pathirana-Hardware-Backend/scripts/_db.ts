import { existsSync } from "node:fs";
import { Client } from "pg";

/** Loads .env (if present) and returns DATABASE_URL, failing clearly when missing. */
export function databaseUrl(): string {
  if (existsSync(".env")) process.loadEnvFile(".env");
  const url = process.env.DATABASE_URL;
  if (!url || !/^postgres(ql)?:\/\//.test(url)) {
    throw new Error("Set DATABASE_URL (postgres://…) for the SEPARATE website database.");
  }
  return url;
}

/** "host:port/db" for display, without user or password. */
export function describe(url: string): string {
  const u = new URL(url);
  return `${u.hostname}:${u.port || 5432}${u.pathname}`;
}

export function databaseName(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
}

export function flag(name: string): string | undefined {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  return hit.includes("=") ? hit.slice(hit.indexOf("=") + 1) : "true";
}

/**
 * Write commands must name the target database explicitly
 * (--confirm-database=<name>), so nothing is applied to the wrong database.
 */
export function requireConfirmation(url: string) {
  const name = databaseName(url);
  if (flag("confirm-database") !== name) {
    throw new Error(
      `Refusing to write. Re-run with --confirm-database=${name} after checking the target is correct.`,
    );
  }
}

export async function connect(url: string): Promise<Client> {
  const client = new Client({ connectionString: url, application_name: "pathirana-web-scripts" });
  await client.connect();
  return client;
}
