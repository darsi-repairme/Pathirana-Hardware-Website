/**
 * A private PostgreSQL for local testing — no PostgreSQL installation and no cloud account needed.
 *
 *   npm run db:local          (leave this terminal open; Ctrl+C stops the database)
 *
 * Uses the `embedded-postgres` package from devDependencies. User, password, port and database name
 * come from DATABASE_URL in this folder's .env, so the API and every script use the same database.
 * Refuses anything that is not on this computer (localhost / 127.0.0.1). Data is kept in ./.local-db
 * (git-ignored) between runs; delete that folder to start again from an empty database.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { setInterval } from "node:timers";
import { URL } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

const root = path.resolve(import.meta.dirname, "..");
if (existsSync(path.join(root, ".env"))) process.loadEnvFile(path.join(root, ".env"));
const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error("DATABASE_URL is missing. Copy .env.example to .env (see TESTER_SETUP.md) first.");
  process.exit(1);
}
const url = new URL(raw);
if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
  console.error(`db:local only runs a database on this computer; DATABASE_URL points to ${url.hostname}.`);
  process.exit(1);
}
const user = decodeURIComponent(url.username || "postgres");
const password = decodeURIComponent(url.password || "");
const port = Number(url.port || 5432);
const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
if (!password || password.length < 8 || /CHANGE_ME/i.test(password)) {
  console.error("Set your own password (8+ characters) in DATABASE_URL in .env before the first run.");
  process.exit(1);
}
if (!/^[a-z_][a-z0-9_]*$/.test(database)) {
  console.error("Use a simple database name in DATABASE_URL: lowercase letters, digits and _ only.");
  process.exit(1);
}

const dataDir = path.join(root, ".local-db", "data");
const db = new EmbeddedPostgres({
  databaseDir: dataDir,
  user,
  password,
  port,
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
});

if (!existsSync(path.join(dataDir, "PG_VERSION"))) {
  console.log(`First run: creating a new local PostgreSQL in ${path.relative(root, dataDir)} …`);
  await db.initialise();
}
await db.start();
const admin = new pg.Client({ host: "127.0.0.1", port, user, password, database: "postgres" });
await admin.connect();
const exists = (await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [database])).rowCount;
await admin.end();
if (!exists) {
  await db.createDatabase(database);
  console.log(`Created database "${database}".`);
}
console.log(`Local PostgreSQL is running on 127.0.0.1:${port} (database "${database}"). Ctrl+C to stop.`);

let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  console.log("Stopping the local database …");
  await db.stop().catch(() => {});
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
