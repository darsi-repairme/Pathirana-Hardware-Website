/**
 * ROLLBACK for a NEW hosted database (e.g. Supabase) that received the website schema:
 * drops ONLY the website's own tables, enum type and trigger function in `public`. Platform schemas
 * (auth, storage, …) and any other object are never touched. Destroys the rows in those
 * tables, so it is for undoing a fresh migration — never for the local source database.
 *
 *   npm run db:drop-website -- --env-file=.env.supabase            → lists what would be dropped
 *   npm run db:drop-website -- --env-file=.env.supabase --apply --confirm-database=postgres --drop-website-schema
 *
 * Requires --env-file; refuses the local source database (the .env target or any database
 * named pathirana_website) and refuses when any unknown table exists in public. One transaction. The revoked default privileges (db:harden) are left
 * revoked, which is the safer state.
 */
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { connect, databaseName, databaseUrl, describe, flag, redact, requireConfirmation } from "./_db";

function sameDatabase(a: string, b: string): boolean {
  const x = new URL(a);
  const y = new URL(b);
  return x.hostname === y.hostname && (x.port || "5432") === (y.port || "5432") && x.pathname === y.pathname;
}

/** Every table created by migrations 0001–0008 (children first) plus the history table. */
const WEBSITE_TABLES = [
  "offer_categories",
  "offer_products",
  "offers",
  "staff_password_tokens",
  "gallery_photos",
  "services",
  "customer_feedback",
  "quotation_notifications",
  "quotation_notification_recipients",
  "quotation_photos",
  "quotation_items",
  "quotation_requests",
  "audit_log",
  "delivery_areas",
  "product_images",
  "product_brands",
  "products",
  "brands",
  "categories",
  "staff",
  "schema_migrations",
];

/** Types created by the migrations (0001: staff_role). */
const WEBSITE_TYPES = ["staff_role"];

async function main() {
  if (!flag("env-file")) throw new Error("Name the hosted database explicitly with --env-file=<file>.");
  const url = databaseUrl();
  const source = existsSync(".env") ? parseEnv(readFileSync(".env", "utf8")).DATABASE_URL?.trim() : undefined;
  if (databaseName(url) === "pathirana_website" || (source && sameDatabase(source, url)))
    throw new Error("Refusing: this target is the local source database. It is never dropped.");
  const client = await connect(url);
  try {
    console.log(`Target: ${describe(url)}`);
    const tables = (
      await client.query<{ t: string; n: string }>(
        `SELECT c.relname AS t, c.reltuples::bigint::text AS n FROM pg_class c
           JOIN pg_namespace s ON s.oid = c.relnamespace WHERE s.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
          ORDER BY 1`,
      )
    ).rows;
    const unknown = tables.filter((r) => !WEBSITE_TABLES.includes(r.t)).map((r) => r.t);
    const present = WEBSITE_TABLES.filter((t) => tables.some((r) => r.t === t));
    console.log(`Website tables present: ${present.join(", ") || "none"}`);
    if (unknown.length) throw new Error(`Refusing: public also holds other objects (${unknown.join(", ")}).`);
    for (const t of present) {
      const n = (await client.query<{ n: string }>(`SELECT count(*)::text AS n FROM public."${t}"`)).rows[0]!
        .n;
      console.log(`  ${t.padEnd(36)} ${n} rows`);
    }
    if (!flag("apply")) {
      console.log("Report only: nothing was dropped.");
      return;
    }
    requireConfirmation(url);
    if (!flag("drop-website-schema"))
      throw new Error("Add --drop-website-schema to confirm dropping these tables.");
    await client.query("BEGIN");
    try {
      for (const t of present) await client.query(`DROP TABLE public."${t}"`);
      await client.query("DROP FUNCTION IF EXISTS public.set_updated_at()");
      for (const t of WEBSITE_TYPES) await client.query(`DROP TYPE IF EXISTS public."${t}"`);
      // Relations, functions and user-defined types (array types go with their base type).
      const left = (
        await client.query<{ n: string }>(
          `SELECT ((SELECT count(*) FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace)
                 + (SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace)
                 + (SELECT count(*) FROM pg_type t WHERE t.typnamespace = 'public'::regnamespace
                      AND t.typtype IN ('e', 'd', 'c') AND t.typrelid = 0))::text AS n`,
        )
      ).rows[0]!.n;
      if (left !== "0") throw new Error(`public still holds ${left} objects; rolled back.`);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
    console.log("Dropped: the public schema is empty again. Platform schemas were not touched.");
  } finally {
    await client.end();
  }
}

main().catch((e: Error & { code?: string }) => {
  console.error(
    `FAILED${e.code ? ` (${e.code})` : ""}: ${redact(e.message, process.env.DATABASE_URL ?? "")}`,
  );
  process.exit(1);
});
