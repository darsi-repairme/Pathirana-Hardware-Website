/**
 * Copies the website's business data from one database to another whose schema was
 * created by the SAME application migrations (e.g. local PostgreSQL 18 → Supabase 17).
 * Schema is never copied: only rows, identity/sequence positions and migration history.
 *
 *   npm run db:transfer -- --to-env-file=.env.supabase                     → checks only (read-only)
 *   npm run db:transfer -- --to-env-file=.env.supabase --apply --confirm-database=postgres
 *   (source: .env, or --from-env-file=<file>)
 *
 * Safety:
 *   - the source is read in a READ ONLY, REPEATABLE READ snapshot (never written);
 *   - the destination must already have every source migration, identical columns and
 *     constraints for every table, NO rows in any website table, and (on Supabase) no
 *     privileges for the API roles (run db:harden first);
 *   - everything is written in ONE destination transaction, in foreign-key order, with
 *     primary keys, timestamps, password hashes and identity values kept exactly; per-table
 *     fingerprints of source and destination must match before COMMIT, else ROLLBACK;
 *   - nothing is printed except table names, counts and fingerprints' match status.
 */
import type { Client } from "pg";
import { connectTarget, databaseName, describe, flag, loadTarget, redact, type DbTarget } from "./_db";
import { exposure } from "./supabase-harden";

type Row = Record<string, string>;
const q = async <T extends object = Row>(c: Client, sql: string, params: unknown[] = []) =>
  (await c.query<T & Row>(sql, params)).rows as T[];

const SESSION = [
  "SET TimeZone = 'UTC'",
  "SET DateStyle = 'ISO, YMD'",
  "SET IntervalStyle = 'postgres'",
  "SET extra_float_digits = 3",
  "SET bytea_output = 'hex'",
  "SET client_encoding = 'UTF8'",
];

async function baseTables(c: Client): Promise<string[]> {
  return (
    await q<{ t: string }>(
      c,
      "SELECT tablename AS t FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations' ORDER BY 1",
    )
  ).map((r) => r.t);
}

/** Column definitions and constraints, compared between source and destination. */
async function shape(c: Client, table: string): Promise<string[]> {
  const cols = await q<{ d: string }>(
    c,
    `SELECT format('col %s %s null=%s def=%s id=%s gen=%s', a.attname, format_type(a.atttypid, a.atttypmod),
                   NOT a.attnotnull, coalesce(pg_get_expr(d.adbin, d.adrelid), ''), a.attidentity, a.attgenerated) AS d
       FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped ORDER BY a.attname`,
    [`public.${table}`],
  );
  const cons = await q<{ d: string }>(
    c,
    `SELECT format('con %s %s %s', conname, contype, regexp_replace(pg_get_constraintdef(oid), '\\s+', ' ', 'g')) AS d
       FROM pg_constraint WHERE conrelid = $1::regclass AND contype IN ('p', 'u', 'f', 'c') ORDER BY conname`,
    [`public.${table}`],
  );
  const idx = await q<{ d: string }>(
    c,
    "SELECT format('idx %s', regexp_replace(indexdef, '\\s+', ' ', 'g')) AS d FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1 ORDER BY indexname",
    [table],
  );
  return [...cols, ...cons, ...idx].map((r) => r.d);
}

/** Parents before children (no table in this schema references itself). */
async function fkOrder(c: Client, tables: string[]): Promise<string[]> {
  const edges = await q<{ child: string; parent: string }>(
    c,
    `SELECT conrelid::regclass::text AS child, confrelid::regclass::text AS parent FROM pg_constraint
      WHERE contype = 'f' AND connamespace = 'public'::regnamespace AND conrelid <> confrelid`,
  );
  const out: string[] = [];
  const left = new Set(tables);
  while (left.size) {
    const ready = [...left].filter((t) => !edges.some((e) => e.child === t && left.has(e.parent))).sort();
    if (!ready.length) throw new Error("Circular foreign keys: cannot order the copy.");
    for (const t of ready) {
      out.push(t);
      left.delete(t);
    }
  }
  return out;
}

async function columns(c: Client, table: string): Promise<string[]> {
  return (
    await q<{ n: string }>(
      c,
      `SELECT attname AS n FROM pg_attribute WHERE attrelid = $1::regclass AND attnum > 0
          AND NOT attisdropped AND attgenerated = '' ORDER BY attnum`,
      [`public.${table}`],
    )
  ).map((r) => r.n);
}

const ident = (s: string) => `"${s.replace(/"/g, '""')}"`;

/** Count + md5 over every row's JSON (sorted): equal fingerprints = identical data. */
async function fingerprint(c: Client, table: string): Promise<string> {
  const r = await q<{ f: string }>(
    c,
    `SELECT count(*) || ':' || coalesce(md5(string_agg(j, E'\\n' ORDER BY j)), '-') AS f
       FROM (SELECT row_to_json(x)::text AS j FROM public.${ident(table)} x) s`,
  );
  return r[0]!.f;
}

async function sequences(c: Client): Promise<Map<string, { last: string; called: boolean }>> {
  const seqs = await q<{ s: string }>(
    c,
    "SELECT sequencename AS s FROM pg_sequences WHERE schemaname = 'public' ORDER BY 1",
  );
  const out = new Map<string, { last: string; called: boolean }>();
  for (const { s } of seqs) {
    const r = (
      await q<{ last: string; called: boolean }>(
        c,
        `SELECT last_value::text AS last, is_called AS called FROM public.${ident(s)}`,
      )
    )[0]!;
    out.set(s, r);
  }
  return out;
}

async function plan(src: Client, dst: Client) {
  const problems: string[] = [];
  const srcMig = await q<{ version: string; applied_at: string }>(
    src,
    "SELECT version, applied_at::text FROM schema_migrations ORDER BY 1",
  );
  const dstHasMig = (
    await q<{ t: string | null }>(dst, "SELECT to_regclass('public.schema_migrations')::text AS t")
  )[0]?.t;
  const dstMig = dstHasMig
    ? (await q<{ version: string }>(dst, "SELECT version FROM schema_migrations")).map((r) => r.version)
    : [];
  const missing = srcMig.map((m) => m.version).filter((v) => !dstMig.includes(v));
  if (missing.length)
    problems.push(`destination lacks migrations: ${missing.join(", ")} (run db:migrate first)`);

  const tables = await baseTables(src);
  const dstTables = await baseTables(dst);
  const counts: Record<string, number> = {};
  for (const t of tables) {
    counts[t] = Number((await q<{ n: string }>(src, `SELECT count(*) AS n FROM public.${ident(t)}`))[0]!.n);
    if (!dstTables.includes(t)) {
      problems.push(`destination has no table ${t}`);
      continue;
    }
    const a = await shape(src, t);
    const b = await shape(dst, t);
    const diff = [...a.filter((x) => !b.includes(x)), ...b.filter((x) => !a.includes(x))];
    if (diff.length) problems.push(`table ${t} differs: ${diff.slice(0, 3).join(" | ")}`);
  }
  for (const t of dstTables) {
    const n = Number((await q<{ n: string }>(dst, `SELECT count(*) AS n FROM public.${ident(t)}`))[0]!.n);
    if (n) problems.push(`destination table ${t} is not empty (${n} rows)`);
  }
  const exp = await exposure(dst);
  if (exp.roles.length && (exp.grants.length || exp.defaults.length))
    problems.push("destination grants website objects to Supabase API roles (run db:harden first)");
  return { problems, tables, counts, srcMig, dstOnly: dstTables.filter((t) => !tables.includes(t)) };
}

async function main() {
  const from: DbTarget = loadTarget(flag("from-env-file") ?? ".env");
  const toFile = flag("to-env-file");
  if (!toFile) throw new Error("Name the destination with --to-env-file=<file> (e.g. .env.supabase).");
  const to: DbTarget = loadTarget(toFile);
  const a = new URL(from.url);
  const b = new URL(to.url);
  if (a.hostname === b.hostname && (a.port || "5432") === (b.port || "5432") && a.pathname === b.pathname)
    throw new Error("Source and destination are the same database.");
  console.log(`Source:      ${describe(from.url)} (read-only)`);
  console.log(`Destination: ${describe(to.url)}`);

  const src = await connectTarget(from, "pathirana-web-transfer-source");
  const dst = await connectTarget(to, "pathirana-web-transfer");
  try {
    for (const s of SESSION) {
      await src.query(s);
      await dst.query(s);
    }
    await src.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const versions = await q<{ s: string; d: string }>(
      src,
      "SELECT current_setting('server_version') AS s, '' AS d",
    );
    const dv = await q<{ v: string }>(dst, "SELECT current_setting('server_version') AS v");
    console.log(`PostgreSQL:  source ${versions[0]!.s} → destination ${dv[0]!.v}`);

    const p = await plan(src, dst);
    console.log("Source rows:");
    for (const t of p.tables) console.log(`  ${t.padEnd(24)} ${p.counts[t]}`);
    if (p.dstOnly.length) console.log(`Destination-only tables (stay empty): ${p.dstOnly.join(", ")}`);
    if (p.problems.length) {
      console.log("BLOCKED:");
      for (const x of p.problems) console.log(`  - ${x}`);
      process.exitCode = 2;
      return;
    }
    console.log("Pre-checks: PASS (schemas identical, destination empty, API roles closed)");
    if (!flag("apply")) {
      console.log("Read-only run: nothing was written. Add --apply --confirm-database=<name> to copy.");
      return;
    }
    const name = databaseName(to.url);
    if (flag("confirm-database") !== name)
      throw new Error(`Refusing to write. Re-run with --confirm-database=${name} after checking the target.`);

    const order = await fkOrder(src, p.tables);
    await dst.query("BEGIN");
    try {
      for (const t of order) {
        if (!p.counts[t]) continue;
        const cols = await columns(src, t);
        const list = cols.map(ident).join(", ");
        const data = (
          await q<{ j: string }>(
            src,
            `SELECT coalesce(json_agg(x), '[]')::text AS j FROM public.${ident(t)} x`,
          )
        )[0]!.j;
        const res = await dst.query(
          `INSERT INTO public.${ident(t)} (${list}) OVERRIDING SYSTEM VALUE
           SELECT ${list} FROM json_populate_recordset(NULL::public.${ident(t)}, $1::json)`,
          [data],
        );
        if (res.rowCount !== p.counts[t])
          throw new Error(`${t}: inserted ${res.rowCount} of ${p.counts[t]} rows`);
      }
      for (const m of p.srcMig) {
        await dst.query("UPDATE schema_migrations SET applied_at = $2::timestamptz WHERE version = $1", [
          m.version,
          m.applied_at,
        ]);
      }
      const srcSeq = await sequences(src);
      for (const [s, v] of srcSeq) {
        await dst.query("SELECT setval($1::regclass, $2::bigint, $3)", [
          `public.${ident(s)}`,
          v.last,
          v.called,
        ]);
      }

      // Verify before COMMIT: every table, the migration history and the sequences.
      const mismatches: string[] = [];
      for (const t of [...p.tables, "schema_migrations"]) {
        const fs = t === "schema_migrations" ? null : await fingerprint(src, t);
        if (fs !== null && fs !== (await fingerprint(dst, t))) mismatches.push(t);
      }
      const dstMigRows = await q<{ version: string; applied_at: string }>(
        dst,
        "SELECT version, applied_at::text FROM schema_migrations WHERE version = ANY($1) ORDER BY 1",
        [p.srcMig.map((m) => m.version)],
      );
      if (JSON.stringify(dstMigRows) !== JSON.stringify(p.srcMig))
        mismatches.push("schema_migrations history");
      const dstSeq = await sequences(dst);
      for (const [s, v] of srcSeq) {
        const d = dstSeq.get(s);
        if (!d || d.last !== v.last || d.called !== v.called) mismatches.push(`sequence ${s}`);
      }
      if (mismatches.length) throw new Error(`Verification failed (${mismatches.join(", ")}); rolled back.`);
      await dst.query("COMMIT");
    } catch (e) {
      await dst.query("ROLLBACK").catch(() => undefined);
      throw e;
    }
    console.log("Copied and verified:");
    for (const t of order) console.log(`  ${t.padEnd(24)} ${p.counts[t]} rows — fingerprint match`);
    console.log(`  schema_migrations        ${p.srcMig.length} applied_at values kept`);
    console.log("  sequences                positions kept");
  } finally {
    await src.query("ROLLBACK").catch(() => undefined);
    await src.end();
    await dst.end();
  }
}

main().catch((e: Error & { code?: string }) => {
  const urls: string[] = [];
  for (const f of [flag("from-env-file") ?? ".env", flag("to-env-file")]) {
    try {
      if (f) urls.push(loadTarget(f).url);
    } catch {
      /* ignore */
    }
  }
  console.error(`FAILED${e.code ? ` (${e.code})` : ""}: ${redact(e.message, ...urls)}`);
  process.exit(1);
});
