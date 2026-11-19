import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { ClientBase } from "pg";

export const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");
const FILE = /^\d{4}_[a-z0-9_]+\.sql$/;

async function appliedVersions(client: ClientBase): Promise<Set<string>> {
  const t = (await client.query<{ t: string | null }>("SELECT to_regclass('public.schema_migrations') AS t"))
    .rows[0]?.t;
  if (!t) return new Set();
  const rows = (await client.query<{ version: string }>("SELECT version FROM schema_migrations")).rows;
  return new Set(rows.map((r) => r.version));
}

/** Migration files not yet applied (read-only). */
export async function pendingMigrations(client: ClientBase, dir = MIGRATIONS_DIR): Promise<string[]> {
  const done = await appliedVersions(client);
  return (await readdir(dir)).filter((f) => FILE.test(f) && !done.has(f)).sort();
}

/**
 * Applies pending migrations in name order, each in its own transaction,
 * recording them in schema_migrations. Returns the applied file names.
 */
export async function applyMigrations(client: ClientBase, dir = MIGRATIONS_DIR): Promise<string[]> {
  // Brand and place names (e.g. Würth) need UTF-8 storage.
  const enc = (await client.query<{ e: string }>("SELECT current_setting('server_encoding') AS e")).rows[0]
    ?.e;
  if (enc !== "UTF8") throw new Error(`The database must use UTF8 encoding (found ${enc}).`);
  await client.query("SET client_encoding = 'UTF8'");
  await client.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const applied: string[] = [];
  for (const file of await pendingMigrations(client, dir)) {
    const sql = await readFile(path.join(dir, file), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
      await client.query("COMMIT");
      applied.push(file);
    } catch (e) {
      await client.query("ROLLBACK");
      throw new Error(`Migration ${file} failed: ${(e as Error).message}`);
    }
  }
  return applied;
}
