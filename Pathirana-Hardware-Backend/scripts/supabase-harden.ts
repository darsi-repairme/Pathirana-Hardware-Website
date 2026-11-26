/**
 * Closes the website tables to Supabase's API roles (defence in depth: the Data API is
 * also switched off in the dashboard). Touches ONLY objects in the `public` schema and
 * this role's own default privileges there — never Supabase's platform schemas.
 *
 *   npm run db:harden -- --env-file=.env.supabase                                  → report only
 *   npm run db:harden -- --env-file=.env.supabase --apply --confirm-database=postgres
 *
 * Applied in ONE transaction:
 *   - REVOKE every privilege on public tables, sequences and functions from anon,
 *     authenticated and service_role (and EXECUTE on public functions from PUBLIC);
 *   - ALTER DEFAULT PRIVILEGES so tables created later by this role are not granted to them;
 *   - ENABLE ROW LEVEL SECURITY (no policies) on every public table this role owns.
 * The API connects as the owning role, which owns the tables (and on Supabase bypasses
 * RLS), so the application is unaffected. Idempotent; re-run after every new migration.
 */
import type { Client } from "pg";
import { connect, databaseUrl, describe, flag, redact, requireConfirmation } from "./_db";

const API_ROLES = ["anon", "authenticated", "service_role"];

export interface Exposure {
  roles: string[];
  grants: string[];
  defaults: string[];
  withoutRls: string[];
}

export async function exposure(client: Client): Promise<Exposure> {
  const roles = (
    await client.query<{ r: string }>(
      "SELECT rolname AS r FROM pg_roles WHERE rolname = ANY($1) ORDER BY 1",
      [API_ROLES],
    )
  ).rows.map((x) => x.r);
  const grants = (
    await client.query<{ g: string }>(
      `SELECT format('%s %s on %s', a.grantee, a.privilege_type, a.object) AS g FROM (
         SELECT grantee::text, privilege_type::text, table_name::text AS object
           FROM information_schema.role_table_grants WHERE table_schema = 'public'
         UNION ALL
         SELECT r.rolname, 'USAGE/SELECT/UPDATE', c.relname FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace, aclexplode(c.relacl) e
           JOIN pg_roles r ON r.oid = e.grantee
          WHERE n.nspname = 'public' AND c.relkind = 'S'
         UNION ALL
         SELECT r.rolname, 'EXECUTE', p.proname FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace, aclexplode(p.proacl) e
           JOIN pg_roles r ON r.oid = e.grantee
          WHERE n.nspname = 'public'
       ) a WHERE a.grantee = ANY($1) GROUP BY 1 ORDER BY 1`,
      [API_ROLES],
    )
  ).rows.map((x) => x.g);
  const defaults = (
    await client.query<{ d: string }>(
      `SELECT DISTINCT format('%s objects (%s) created by %s', r.rolname, d.defaclobjtype, pg_get_userbyid(d.defaclrole)) AS d
         FROM pg_default_acl d JOIN pg_namespace n ON n.oid = d.defaclnamespace, aclexplode(d.defaclacl) e
         JOIN pg_roles r ON r.oid = e.grantee
        WHERE n.nspname = 'public' AND d.defaclrole = (SELECT oid FROM pg_roles WHERE rolname = current_user)
          AND r.rolname = ANY($1) ORDER BY 1`,
      [API_ROLES],
    )
  ).rows.map((x) => x.d);
  const withoutRls = (
    await client.query<{ t: string }>(
      `SELECT c.relname AS t FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
          AND pg_get_userbyid(c.relowner) = current_user ORDER BY 1`,
    )
  ).rows.map((x) => x.t);
  return { roles, grants, defaults, withoutRls };
}

function print(e: Exposure) {
  console.log(`API roles present: ${e.roles.join(", ") || "none (not a Supabase database)"}`);
  console.log(`Privileges held by API roles on public objects: ${e.grants.length || "none"}`);
  for (const g of e.grants.slice(0, 40)) console.log(`  ${g}`);
  console.log(`Default privileges granting future objects to API roles: ${e.defaults.length || "none"}`);
  for (const d of e.defaults) console.log(`  ${d}`);
  console.log(`Public tables without row level security: ${e.withoutRls.join(", ") || "none"}`);
}

async function main() {
  const url = databaseUrl();
  const client = await connect(url);
  try {
    console.log(`Target: ${describe(url)}`);
    const before = await exposure(client);
    print(before);
    if (!flag("apply")) return;
    requireConfirmation(url);
    if (!before.roles.length) throw new Error("No Supabase API roles in this database: nothing to harden.");

    const roles = before.roles.map((r) => `"${r}"`).join(", ");
    await client.query("BEGIN");
    try {
      await client.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${roles}`);
      await client.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${roles}`);
      await client.query(`REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, ${roles}`);
      for (const kind of ["TABLES", "SEQUENCES", "FUNCTIONS"]) {
        await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ${kind} FROM ${roles}`);
      }
      for (const t of before.withoutRls) {
        await client.query(`ALTER TABLE public."${t.replace(/"/g, '""')}" ENABLE ROW LEVEL SECURITY`);
      }
      const after = await exposure(client);
      if (after.grants.length || after.defaults.length || after.withoutRls.length) {
        print(after);
        throw new Error("Hardening incomplete; rolled back.");
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
    console.log(
      "Hardened: API roles hold no privileges on public objects; RLS enabled on all public tables.",
    );
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((e: Error & { code?: string }) => {
    console.error(
      `FAILED${e.code ? ` (${e.code})` : ""}: ${redact(e.message, process.env.DATABASE_URL ?? "")}`,
    );
    process.exit(1);
  });
}
