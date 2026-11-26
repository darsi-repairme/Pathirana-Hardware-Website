/**
 * READ-ONLY connection check for a website database (e.g. Supabase).
 *
 *   npm run db:check                                  → the database in .env
 *   npm run db:check -- --env-file=.env.supabase      → the database in .env.supabase
 *
 * Runs only SELECTs inside a READ ONLY transaction (which is rolled back). Never prints
 * the connection string, user name or password.
 */
import type { TLSSocket } from "node:tls";
import { pendingMigrations } from "../src/database/migrator";
import { connect, databaseName, databaseUrl, describe } from "./_db";

// Schemas Supabase creates and manages itself (not website data).
const PLATFORM_SCHEMAS = new Set([
  "auth",
  "storage",
  "realtime",
  "extensions",
  "graphql",
  "graphql_public",
  "vault",
  "pgsodium",
  "pgsodium_masks",
  "pgbouncer",
  "net",
  "cron",
  "supabase_functions",
  "supabase_migrations",
  "_realtime",
  "_analytics",
]);

function redact(message: string, url: string): string {
  const u = new URL(url);
  let out = message;
  for (const secret of [
    u.password,
    decodeURIComponent(u.password),
    u.username,
    decodeURIComponent(u.username),
  ]) {
    if (secret) out = out.split(secret).join("***");
  }
  return out;
}

async function main() {
  const url = databaseUrl();
  console.log(`Target: ${describe(url)}`);
  const client = await connect(url);
  try {
    const socket = (client as unknown as { connection: { stream: TLSSocket } }).connection.stream;
    if (socket.encrypted) {
      const cert = socket.getPeerCertificate();
      console.log(
        `TLS: ${socket.getProtocol()} ${socket.getCipher()?.name}; certificate verified: ${socket.authorized}` +
          (socket.authorized ? "" : ` (${String(socket.authorizationError)})`),
      );
      console.log(
        `  server certificate: CN=${cert.subject?.CN}; issued by CN=${cert.issuer?.CN}; valid to ${cert.valid_to}`,
      );
    } else {
      console.log("TLS: not used (local connection only)");
    }

    await client.query("BEGIN TRANSACTION READ ONLY");
    const info = (
      await client.query<{
        version: string;
        server_version: string;
        db: string;
        encoding: string;
        ro: string;
      }>(
        `SELECT version() AS version, current_setting('server_version') AS server_version,
                current_database() AS db, current_setting('server_encoding') AS encoding,
                current_setting('transaction_read_only') AS ro`,
      )
    ).rows[0]!;
    console.log(`PostgreSQL: ${info.server_version}  (${info.version.split(",")[0]})`);
    console.log(`Database: ${info.db}; encoding ${info.encoding}; read-only session: ${info.ro}`);

    const tables = (
      await client.query<{ name: string; type: string }>(
        `SELECT table_name AS name, table_type AS type FROM information_schema.tables
          WHERE table_schema = 'public' ORDER BY table_name`,
      )
    ).rows;
    console.log(
      tables.length
        ? `public schema: ${tables.length} tables/views: ${tables.map((t) => t.name).join(", ")}`
        : "public schema: EMPTY (no tables or views)",
    );
    const objects = (
      await client.query<{ kind: string; n: string }>(
        `SELECT c.relkind::text AS kind, count(*)::text AS n FROM pg_class c
           JOIN pg_namespace s ON s.oid = c.relnamespace WHERE s.nspname = 'public' GROUP BY 1
         UNION ALL
         SELECT 'function', count(*)::text FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
          WHERE s.nspname = 'public'`,
      )
    ).rows.filter((r) => r.n !== "0");
    console.log(
      `public objects: ${objects.length ? objects.map((o) => `${o.kind}=${o.n}`).join(", ") : "none"}`,
    );

    const schemas = (
      await client.query<{ name: string }>(
        `SELECT nspname AS name FROM pg_namespace
          WHERE nspname NOT LIKE 'pg\\_%' AND nspname NOT IN ('information_schema', 'public') ORDER BY 1`,
      )
    ).rows.map((r) => r.name);
    const userSchemas = schemas.filter((s) => !PLATFORM_SCHEMAS.has(s));
    console.log(
      `Other schemas: ${userSchemas.length ? userSchemas.join(", ") : "none besides platform schemas"}`,
    );
    console.log(
      `  platform schemas present: ${schemas.filter((s) => PLATFORM_SCHEMAS.has(s)).join(", ") || "none"}`,
    );

    const priv = (
      await client.query<{ create_public: boolean; create_db: boolean; superuser: boolean }>(
        `SELECT has_schema_privilege('public', 'CREATE') AS create_public,
                has_database_privilege(current_database(), 'CREATE') AS create_db,
                (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS superuser`,
      )
    ).rows[0]!;
    console.log(
      `Privileges: CREATE on public=${priv.create_public}; CREATE on database=${priv.create_db}; superuser=${priv.superuser}`,
    );

    const apiRoles = (
      await client.query<{ role: string }>(
        `SELECT rolname AS role FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role') ORDER BY 1`,
      )
    ).rows.map((r) => r.role);
    const defaults = (
      await client.query<{ acl: string }>(
        `SELECT d.defaclacl::text AS acl FROM pg_default_acl d
           JOIN pg_namespace n ON n.oid = d.defaclnamespace
          WHERE n.nspname = 'public' AND d.defaclobjtype = 'r' AND d.defaclrole = (SELECT oid FROM pg_roles WHERE rolname = current_user)`,
      )
    ).rows.map((r) => r.acl);
    const exposed = ["anon", "authenticated"].filter((r) => defaults.some((acl) => acl.includes(`${r}=`)));
    console.log(`Data API roles: ${apiRoles.join(", ") || "none"}`);
    console.log(
      exposed.length
        ? `  WARNING: new tables in public are granted to ${exposed.join(" and ")} by default (Data API exposure; run db:harden)`
        : "  tables this role creates in public are not granted to anon/authenticated by default",
    );

    const pending = await pendingMigrations(client);
    console.log(
      `Migrations: ${pending.length} pending of this API${pending.length ? `: ${pending.join(", ")}` : ""}`,
    );
    console.log(`Migration target name for --confirm-database: ${databaseName(url)}`);
    await client.query("ROLLBACK");
    console.log("Check finished: nothing was written.");
  } finally {
    await client.end();
  }
}

main().catch((e: Error & { code?: string }) => {
  let msg = e.message;
  try {
    msg = redact(msg, process.env.DATABASE_URL ?? "");
  } catch {
    /* URL unusable: message already contains no secret */
  }
  console.error(`Connection check FAILED${e.code ? ` (${e.code})` : ""}: ${msg}`);
  process.exit(1);
});
