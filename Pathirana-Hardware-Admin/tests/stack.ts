/**
 * Isolated end-to-end stack for the admin tests (never touches a permanent
 * database):  throwaway embedded PostgreSQL → compiled API (port 4310) →
 * admin production server (port 4400). Test-only staff accounts are created
 * in the throwaway database; everything is deleted afterwards.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const BACKEND_DIR = process.env.BACKEND_DIR ?? path.resolve(__dirname, "../../Pathirana-Hardware-Backend");
export const API_PORT = 4310;
/** Overridable (E2E_ADMIN_PORT) so the tests can run while the live admin uses 4400. */
export const ADMIN_PORT = Number(process.env.E2E_ADMIN_PORT || 4400);
export const STAFF = {
  admin: { email: "e2e-admin@test.invalid", password: "E2e-Admin-Password-1", name: "Test Administrator" },
  editor: { email: "e2e-editor@test.invalid", password: "E2e-Editor-Password-2", name: "Test Editor" },
  /** Used only by the sign-in / sign-out test (sign-out revokes all of its sessions). */
  session: { email: "e2e-session@test.invalid", password: "E2e-Session-Password-3", name: "Session Tester" },
};
const ROLE_OF: Record<keyof typeof STAFF, string> = { admin: "admin", editor: "editor", session: "editor" };

type PgInstance = {
  initialise(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  createDatabase(n: string): Promise<void>;
};
type Stack = { pg: PgInstance; dir: string; api: ChildProcess; admin: ChildProcess; dbUrl: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(url: string, ms = 60_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(url, { redirect: "manual" });
      if (r.status < 500) return;
    } catch {}
    await sleep(300);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

/** Refuses to run when a live API or admin already listens on the test ports (the tests would hit it). */
async function assertPortsFree() {
  for (const port of [API_PORT, ADMIN_PORT]) {
    const inUse = await fetch(`http://127.0.0.1:${port}/`, { redirect: "manual" }).then(
      () => true,
      () => false,
    );
    if (inUse) throw new Error(`Port ${port} is already in use — stop that server before running the e2e tests.`);
  }
}

export async function startStack(): Promise<Stack> {
  await assertPortsFree();
  const req = createRequire(path.join(BACKEND_DIR, "package.json"));
  const { default: EmbeddedPostgres } = (await import(
    pathToFileURL(path.join(BACKEND_DIR, "node_modules/embedded-postgres/dist/index.js")).href
  )) as { default: new (o: object) => PgInstance };
  const pgLib = req("pg") as {
    Client: new (o: { connectionString: string }) => {
      connect(): Promise<void>;
      query(sql: string, params?: unknown[]): Promise<unknown>;
      end(): Promise<void>;
    };
  };
  const { applyMigrations } = req("./dist/database/migrator.js") as {
    applyMigrations: (c: unknown) => Promise<string[]>;
  };
  const { hashPassword } = req("./dist/auth/password.js") as { hashPassword: (p: string) => Promise<string> };

  const dir = await mkdtemp(path.join(process.env.TEMP ?? "D:/.tmp", "pathirana-admin-e2e-pg-"));
  const port = 55000 + Math.floor(Math.random() * 1000);
  const pg = new EmbeddedPostgres({
    databaseDir: path.join(dir, "data"),
    user: "postgres",
    password: "e2e-only",
    port,
    persistent: false,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("admin_e2e");
  const dbUrl = `postgres://postgres:e2e-only@127.0.0.1:${port}/admin_e2e`;
  const client = new pgLib.Client({ connectionString: dbUrl });
  await client.connect();
  await applyMigrations(client);
  for (const [key, s] of Object.entries(STAFF)) {
    const role = ROLE_OF[key as keyof typeof STAFF];
    await client.query("INSERT INTO staff (email, full_name, role, password_hash) VALUES ($1, $2, $3, $4)", [
      s.email,
      s.name,
      role,
      await hashPassword(s.password),
    ]);
  }
  await client.end();

  const api = spawn(process.execPath, ["dist/main.js"], {
    cwd: BACKEND_DIR,
    env: {
      PATH: process.env.PATH,
      SYSTEMROOT: process.env.SYSTEMROOT,
      NODE_ENV: "test",
      PORT: String(API_PORT),
      DATABASE_URL: dbUrl,
      JWT_SECRET: randomBytes(32).toString("hex"),
      CORS_ORIGINS: `http://127.0.0.1:${ADMIN_PORT}`,
      UPLOAD_DIR: path.join(dir, "uploads"),
      TRUST_PROXY: "true",
      LOG_LEVEL: "warn",
    },
    stdio: ["ignore", "ignore", "inherit"],
  });
  await waitFor(`http://127.0.0.1:${API_PORT}/api/health`);

  const nextBin = path.resolve(__dirname, "../node_modules/next/dist/bin/next");
  const admin = spawn(process.execPath, [nextBin, "start", "-p", String(ADMIN_PORT), "-H", "127.0.0.1"], {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      NODE_ENV: "production",
      BACKEND_API_URL: `http://127.0.0.1:${API_PORT}`,
      ADMIN_COOKIE_SECURE: "false",
      ADMIN_TRUST_PROXY: "true",
    },
    stdio: ["ignore", "ignore", "inherit"],
  });
  await waitFor(`http://127.0.0.1:${ADMIN_PORT}/login`);
  return { pg, dir, api, admin, dbUrl };
}

export async function stopStack(s: Stack) {
  s.admin.kill();
  s.api.kill();
  await s.pg.stop().catch(() => {});
  await sleep(500);
  await rm(s.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
