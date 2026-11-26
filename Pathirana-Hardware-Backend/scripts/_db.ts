import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { Client } from "pg";
import { pgConnectionOptions } from "../src/database/pg-tls";

/** One database target: URL plus TLS settings, never printed. */
export interface DbTarget {
  url: string;
  ssl: boolean;
  caFile?: string;
}

const DB_KEYS = ["DATABASE_URL", "DATABASE_SSL", "DATABASE_SSL_CA_FILE"] as const;

function checkUrl(raw: string | undefined): string {
  const url = raw?.trim();
  if (!url || !/^postgres(ql)?:\/\//.test(url)) {
    throw new Error("Set DATABASE_URL (postgres://…) for the SEPARATE website database.");
  }
  if (url.includes("[YOUR-PASSWORD]")) throw new Error("DATABASE_URL still contains [YOUR-PASSWORD].");
  try {
    new URL(url);
  } catch {
    throw new Error(
      "DATABASE_URL is not a valid URL. Percent-encode special characters in the password (@ : / ? # [ ] %).",
    );
  }
  return url;
}

const isTrue = (v: string | undefined) => ["true", "1"].includes((v ?? "").trim());

/**
 * Reads ONE configuration file into a target without touching process.env, so two
 * databases (e.g. local source and Supabase destination) can be used side by side.
 */
export function loadTarget(envFile: string): DbTarget {
  if (!existsSync(envFile)) throw new Error(`Configuration file not found: ${envFile}`);
  const values = parseEnv(readFileSync(envFile, "utf8"));
  return {
    url: checkUrl(values.DATABASE_URL),
    ssl: isTrue(values.DATABASE_SSL),
    caFile: values.DATABASE_SSL_CA_FILE?.trim() || undefined,
  };
}

/**
 * Loads the configuration and returns DATABASE_URL, failing clearly when missing.
 * Default: .env (the local database). With --env-file=<file> (e.g. .env.supabase) ONLY
 * that file is used and its values win over the shell, so the target is explicit.
 */
export function databaseUrl(): string {
  const envFile = flag("env-file");
  if (envFile) {
    const t = loadTarget(envFile);
    for (const k of DB_KEYS) delete process.env[k];
    process.env.DATABASE_URL = t.url;
    process.env.DATABASE_SSL = String(t.ssl);
    if (t.caFile) process.env.DATABASE_SSL_CA_FILE = t.caFile;
  } else if (existsSync(".env")) process.loadEnvFile(".env");
  return checkUrl(process.env.DATABASE_URL);
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

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

/** Connects to a target; a non-local host is refused without (verified) TLS. */
export async function connectTarget(t: DbTarget, applicationName = "pathirana-web-scripts"): Promise<Client> {
  if (!t.ssl && !LOCAL_HOSTS.has(new URL(t.url).hostname)) {
    throw new Error("Refusing to connect to a remote database without TLS. Set DATABASE_SSL=true.");
  }
  const client = new Client({
    ...pgConnectionOptions({ DATABASE_URL: t.url, DATABASE_SSL: t.ssl, DATABASE_SSL_CA_FILE: t.caFile }),
    application_name: applicationName,
  });
  await client.connect();
  return client;
}

/** Connects using the configuration loaded by databaseUrl(). */
export function connect(url: string): Promise<Client> {
  return connectTarget({
    url,
    ssl: isTrue(process.env.DATABASE_SSL),
    caFile: process.env.DATABASE_SSL_CA_FILE?.trim() || undefined,
  });
}

/** Removes the user name and password of the given URLs from an error message. */
export function redact(message: string, ...urls: string[]): string {
  let out = message;
  for (const url of urls) {
    try {
      const u = new URL(url);
      for (const s of [
        u.password,
        decodeURIComponent(u.password),
        u.username,
        decodeURIComponent(u.username),
      ]) {
        if (s && s.length > 2) out = out.split(s).join("***");
      }
    } catch {
      /* not a URL */
    }
  }
  return out;
}
