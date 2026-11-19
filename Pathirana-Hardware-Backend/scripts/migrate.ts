/**
 * Database migrations for the SEPARATE website database.
 *
 *   npm run db:migrate                                   → shows pending migrations (read-only)
 *   npm run db:migrate -- --apply --confirm-database=NAME → applies them
 *
 * Safety: refuses to apply to a database that already holds tables this API
 * does not own (e.g. the POS database).
 */
import { applyMigrations, pendingMigrations } from "../src/database/migrator";
import { connect, databaseUrl, describe, flag, requireConfirmation } from "./_db";

const OWN_TABLES = new Set([
  "schema_migrations",
  "staff",
  "categories",
  "brands",
  "products",
  "product_brands",
  "product_images",
  "delivery_areas",
  "audit_log",
]);

async function main() {
  const url = databaseUrl();
  const client = await connect(url);
  try {
    console.log(`Target: ${describe(url)}`);
    const pending = await pendingMigrations(client);
    console.log(pending.length ? `Pending:\n  ${pending.join("\n  ")}` : "No pending migrations.");
    if (!flag("apply") || !pending.length) return;

    requireConfirmation(url);
    const foreign = (
      await client.query<{ table_name: string }>(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
      )
    ).rows
      .map((r) => r.table_name)
      .filter((t) => !OWN_TABLES.has(t));
    if (foreign.length) {
      throw new Error(
        `Refusing to migrate: this database contains other tables (${foreign.slice(0, 5).join(", ")}…). ` +
          "Use a separate, dedicated website database.",
      );
    }
    const applied = await applyMigrations(client);
    console.log(`Applied:\n  ${applied.join("\n  ")}`);
  } finally {
    await client.end();
  }
}

main().catch((e: Error) => {
  console.error(e.message);
  process.exit(1);
});
