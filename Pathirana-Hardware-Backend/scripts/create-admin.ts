/**
 * Creates the FIRST administrator account (once). Further staff accounts are
 * created by an admin through POST /api/v1/admin/staff.
 *
 *   npm run admin:create -- --email=owner@example.com --name="Full Name" --confirm-database=NAME
 *
 * The password is typed at a hidden prompt (or read once from the
 * ADMIN_PASSWORD environment variable for automated setups). Nothing is
 * hardcoded and the password is never printed or logged.
 */
import { createInterface } from "node:readline";
import { hashPassword, passwordProblem } from "../src/auth/password";
import { connect, databaseUrl, describe, flag, requireConfirmation } from "./_db";

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    let prompted = false;
    out._writeToOutput = (s: string) => {
      if (!prompted) {
        out.output.write(s);
        prompted = true;
      }
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function main() {
  const email = flag("email")?.trim().toLowerCase();
  const name = flag("name")?.trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name) {
    throw new Error(
      'Usage: npm run admin:create -- --email=you@example.com --name="Full Name" --confirm-database=NAME',
    );
  }
  const url = databaseUrl();
  requireConfirmation(url);
  console.log(`Target: ${describe(url)}`);

  const client = await connect(url);
  try {
    const existing = await client.query("SELECT 1 FROM staff WHERE role = 'admin' AND is_active LIMIT 1");
    if (existing.rowCount)
      throw new Error("An active administrator already exists. Create staff through the API.");

    let password = process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_PASSWORD;
    if (!password) {
      password = await askHidden("Password (min 12 characters): ");
      if ((await askHidden("Repeat password: ")) !== password) throw new Error("Passwords do not match.");
    }
    const problem = passwordProblem(password);
    if (problem) throw new Error(problem);

    const { rows } = await client.query<{ id: string }>(
      "INSERT INTO staff (email, full_name, role, password_hash) VALUES ($1, $2, 'admin', $3) RETURNING id",
      [email, name, await hashPassword(password)],
    );
    await client.query(
      "INSERT INTO audit_log (staff_id, action, entity_type, entity_id) VALUES ($1, 'staff.create-initial-admin', 'staff', $1)",
      [rows[0]!.id],
    );
    console.log(`Administrator created for ${email}.`);
  } finally {
    await client.end();
  }
}

main().catch((e: Error) => {
  console.error(e.message);
  process.exit(1);
});
