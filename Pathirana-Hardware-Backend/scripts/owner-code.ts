/**
 * Prints a one-time Owner set-up code for the Admin page /setup-owner (first administrator).
 * Only works while the database has NO administrator; afterwards registration is closed.
 *
 *   npm run owner:code -- --confirm-database=NAME [--minutes=30] [--env-file=.env.supabase]
 *
 * The code is signed with the API's JWT_SECRET (read from the same configuration file as the
 * API), so it must be generated with the SAME configuration the running API uses. It is shown
 * once in this terminal and never stored or logged.
 */
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { connect, databaseUrl, describe, flag, requireConfirmation } from "./_db";
import { createOwnerCode, OWNER_CODE_MAX_MINUTES } from "../src/staff/owner-code";

/** Same order as the API (src/main.ts): the --env-file (ENV_FILE) first, then .env, then the shell. */
function jwtSecret(): string {
  const files = [flag("env-file"), ".env"].filter((f): f is string => !!f && existsSync(f));
  const fromFile = files.map((f) => parseEnv(readFileSync(f, "utf8")).JWT_SECRET).find(Boolean);
  const secret = fromFile ?? process.env.JWT_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("JWT_SECRET (at least 32 characters) is missing from the API configuration.");
  return secret;
}

async function main() {
  const minutes = Number(flag("minutes") ?? "30");
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > OWNER_CODE_MAX_MINUTES)
    throw new Error(`--minutes must be a whole number from 1 to ${OWNER_CODE_MAX_MINUTES}.`);
  const secret = jwtSecret();
  const url = databaseUrl();
  requireConfirmation(url);
  const client = await connect(url);
  try {
    const admins = await client.query("SELECT 1 FROM staff WHERE role = 'admin' LIMIT 1");
    if (admins.rowCount)
      throw new Error("An administrator already exists: Owner registration is closed. No code was created.");
  } finally {
    await client.end();
  }
  const { code, expiresAt } = createOwnerCode(secret, minutes);
  console.log(`Database: ${describe(url)} (no administrator yet)`);
  console.log("");
  console.log(`  Owner set-up code:  ${code}`);
  console.log(
    `  Valid until:        ${expiresAt.toLocaleString("en-GB", { timeZone: "Asia/Colombo" })} (Sri Lanka time)`,
  );
  console.log("");
  console.log(
    "Enter it on the Admin page /setup-owner. Do not share it; it stops working once the Owner is registered.",
  );
}

main().catch((e: Error) => {
  console.error(e.message);
  process.exit(1);
});
