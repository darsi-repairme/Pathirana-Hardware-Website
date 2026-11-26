// Starts an ISOLATED, throwaway PostgreSQL for the integration tests
// (embedded-postgres binaries, data directory under D:/.tmp, random port).
// No other database is touched; everything is deleted in global-teardown.
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:net";
import { pathToFileURL } from "node:url";

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

export default async function globalSetup() {
  const startedAt = Date.now();
  // TEST_EMBEDDED_PG_MODULE: optional path to another embedded-postgres build (e.g. 17.x to
  // match a hosted server's major version); default is the project's own.
  const moduleId = process.env.TEST_EMBEDDED_PG_MODULE
    ? pathToFileURL(process.env.TEST_EMBEDDED_PG_MODULE).href
    : "embedded-postgres";
  const { default: EmbeddedPostgres } = await import(moduleId);
  const base =
    process.env.TEST_PG_DIR ??
    (process.env.TEMP && /^[A-Za-z]:/.test(process.env.TEMP) ? process.env.TEMP : tmpdir());
  const dir = await mkdtemp(path.join(base, "pathirana-api-test-pg-"));
  const port = await freePort();
  const pg = new EmbeddedPostgres({
    databaseDir: path.join(dir, "data"),
    user: "postgres",
    password: "test-only-password",
    port,
    persistent: false,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("pathirana_api_test");
  globalThis.__TEST_PG__ = { pg, dir, startedAt };

  process.env.DATABASE_URL = `postgres://postgres:test-only-password@127.0.0.1:${port}/pathirana_api_test`;
  process.env.TEST_UPLOAD_DIR = path.join(dir, "uploads");
  // Migrations are applied by test/helpers.ts with the production runner.
}
