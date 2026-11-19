/**
 * Isolated, REAL end-to-end stack for the public website (never touches a
 * permanent database):
 *   throwaway embedded PostgreSQL (all migrations) → compiled website API
 *   (port 4320) → the site built into ./out-live with NEXT_PUBLIC_API_URL
 *   pointing at that API, served like a static host (port 4176).
 * One test-only administrator is created; everything is deleted afterwards.
 *
 * Needs: the Backend's `npm run build` (dist/) and `node scripts/build-live-stack.mjs`.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { LIVE_API_PORT, LIVE_SITE_PORT } from "./ports.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const BACKEND_DIR = process.env.BACKEND_DIR ?? path.resolve(ROOT, "../Pathirana-Hardware-Backend");
export const ADMIN = { email: "live-stack-admin@test.invalid", password: "Live-Stack-Admin-Password-1" };

type Pg = {
  initialise(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  createDatabase(n: string): Promise<void>;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(url: string, ms = 60_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).status < 500) return;
    } catch {}
    await sleep(300);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

export default async function globalSetup() {
  for (const port of [LIVE_API_PORT, LIVE_SITE_PORT]) {
    const busy = await fetch(`http://127.0.0.1:${port}/`).then(
      () => true,
      () => false,
    );
    if (busy) throw new Error(`Port ${port} is already in use — stop that server first.`);
  }
  if (!existsSync(path.join(ROOT, "out-live", "index.html"))) {
    throw new Error("Build the test site first: node scripts/build-live-stack.mjs");
  }
  const req = createRequire(path.join(BACKEND_DIR, "package.json"));
  const { default: EmbeddedPostgres } = (await import(
    pathToFileURL(path.join(BACKEND_DIR, "node_modules/embedded-postgres/dist/index.js")).href
  )) as { default: new (o: object) => Pg };
  const { Client } = req("pg") as {
    Client: new (o: { connectionString: string }) => {
      connect(): Promise<void>;
      query(sql: string, p?: unknown[]): Promise<unknown>;
      end(): Promise<void>;
    };
  };
  const { applyMigrations } = req("./dist/database/migrator.js") as {
    applyMigrations: (c: unknown) => Promise<string[]>;
  };
  const { hashPassword } = req("./dist/auth/password.js") as { hashPassword: (p: string) => Promise<string> };

  const dir = await mkdtemp(path.join(process.env.TEMP ?? "D:/.tmp", "pathirana-live-stack-"));
  const pgPort = 56000 + Math.floor(Math.random() * 1000);
  const pg = new EmbeddedPostgres({
    databaseDir: path.join(dir, "data"),
    user: "postgres",
    password: "live-stack-only",
    port: pgPort,
    persistent: false,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("live_stack");
  const dbUrl = `postgres://postgres:live-stack-only@127.0.0.1:${pgPort}/live_stack`;
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  await applyMigrations(client);
  await client.query("INSERT INTO staff (email, full_name, role, password_hash) VALUES ($1, $2, 'admin', $3)", [
    ADMIN.email,
    "Live Stack Test Admin",
    await hashPassword(ADMIN.password),
  ]);
  await client.end();

  const procs: ChildProcess[] = [];
  procs.push(
    spawn(process.execPath, ["dist/main.js"], {
      cwd: BACKEND_DIR,
      env: {
        PATH: process.env.PATH,
        SYSTEMROOT: process.env.SYSTEMROOT,
        NODE_ENV: "test",
        PORT: String(LIVE_API_PORT),
        DATABASE_URL: dbUrl,
        JWT_SECRET: randomBytes(32).toString("hex"),
        CORS_ORIGINS: `http://127.0.0.1:${LIVE_SITE_PORT}`,
        UPLOAD_DIR: path.join(dir, "uploads"),
        LOG_LEVEL: "warn",
      },
      stdio: ["ignore", "ignore", "inherit"],
    }),
  );
  procs.push(
    spawn(process.execPath, ["scripts/serve-static.mjs", "out-live", String(LIVE_SITE_PORT)], {
      cwd: ROOT,
      stdio: ["ignore", "ignore", "inherit"],
    }),
  );
  await waitFor(`http://127.0.0.1:${LIVE_API_PORT}/api/health`);
  await waitFor(`http://127.0.0.1:${LIVE_SITE_PORT}/`);

  return async () => {
    for (const p of procs) p.kill();
    await pg.stop().catch(() => {});
    await sleep(500);
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  };
}
