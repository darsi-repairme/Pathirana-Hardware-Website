/**
 * Adds the owner-confirmed delivery service areas (Batch 5B) to the website
 * database — only those not already listed. Existing records (e.g. Puttalam)
 * are left exactly as they are; nothing is invented (no district, postal code,
 * notes or fee).
 *
 *   npm run areas:add                                        → shows what would change (read-only)
 *   npm run areas:add -- --apply --confirm-database=NAME     → adds the missing areas
 */
import { connect, databaseUrl, describe, flag, requireConfirmation } from "./_db";

/** Confirmed by the owner (2026-11-18): delivery is available in all of them. */
export const SERVICE_AREAS = [
  "Bangadeniya",
  "Chilaw",
  "Pallama",
  "Anamaduwa",
  "Arachikattuwa",
  "Puttalam",
  "Wennappuwa",
  "Marawila",
] as const;

async function main() {
  const url = databaseUrl();
  const client = await connect(url);
  try {
    console.log(`Target: ${describe(url)}`);
    const existing = (
      await client.query<{ name: string; is_active: boolean }>(
        "SELECT name, is_active FROM delivery_areas WHERE archived_at IS NULL",
      )
    ).rows;
    const missing: string[] = [];
    for (const name of SERVICE_AREAS) {
      const found = existing.find((r) => r.name.trim().toLowerCase() === name.toLowerCase());
      if (found)
        console.log(
          `  exists   ${found.name}${found.is_active ? "" : "  (INACTIVE — activate it in the Admin if needed)"}`,
        );
      else {
        missing.push(name);
        console.log(`  missing  ${name}`);
      }
    }
    if (!flag("apply") || !missing.length) return;
    requireConfirmation(url);
    await client.query("BEGIN");
    try {
      for (const name of missing) {
        const { rows } = await client.query<{ id: string }>(
          "INSERT INTO delivery_areas (name, is_active) VALUES ($1, true) RETURNING id",
          [name],
        );
        await client.query(
          "INSERT INTO audit_log (staff_id, action, entity_type, entity_id, details) VALUES (NULL, $1, $2, $3, $4)",
          [
            "delivery-area.create",
            "delivery_area",
            rows[0]!.id,
            { name, source: "owner-confirmed service areas" },
          ],
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
    console.log(`Added: ${missing.join(", ")}`);
  } finally {
    await client.end();
  }
}

main().catch((e: Error) => {
  console.error(e.message);
  process.exit(1);
});
