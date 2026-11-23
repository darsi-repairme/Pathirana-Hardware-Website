import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pgConnectionOptions } from "./pg-tls";

const PEM = "-----BEGIN CERTIFICATE-----\nMIIBfake\n-----END CERTIFICATE-----\n";

describe("pgConnectionOptions", () => {
  let dir: string;
  beforeAll(() => (dir = mkdtempSync(path.join(tmpdir(), "pgtls-"))));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("leaves a local connection unchanged when TLS is off", () => {
    const url = "postgres://u:p@127.0.0.1:5432/db";
    expect(pgConnectionOptions({ DATABASE_URL: url, DATABASE_SSL: false })).toEqual({
      connectionString: url,
    });
  });

  it("always verifies the certificate when TLS is on", () => {
    const o = pgConnectionOptions({ DATABASE_URL: "postgresql://u:p@h.example:5432/db", DATABASE_SSL: true });
    expect(o.ssl).toEqual({ rejectUnauthorized: true });
  });

  it("pins the CA file and strips URL TLS parameters that would override it", () => {
    const ca = path.join(dir, "ca.crt");
    writeFileSync(ca, PEM);
    const o = pgConnectionOptions({
      DATABASE_URL:
        "postgresql://u.ref:p%40ss@pooler.example.com:5432/postgres?sslmode=disable&sslrootcert=x&application_name=a",
      DATABASE_SSL: true,
      DATABASE_SSL_CA_FILE: ca,
    });
    expect(o.ssl).toEqual({ rejectUnauthorized: true, ca: PEM });
    expect(o.connectionString).toBe(
      "postgresql://u.ref:p%40ss@pooler.example.com:5432/postgres?application_name=a",
    );
  });

  it("refuses a missing or non-PEM CA file, and a CA file without TLS", () => {
    const bad = path.join(dir, "bad.crt");
    writeFileSync(bad, "not a certificate");
    const url = "postgresql://u:p@h:5432/db";
    expect(() =>
      pgConnectionOptions({ DATABASE_URL: url, DATABASE_SSL: true, DATABASE_SSL_CA_FILE: bad }),
    ).toThrow(/not a PEM certificate/);
    expect(() =>
      pgConnectionOptions({
        DATABASE_URL: url,
        DATABASE_SSL: true,
        DATABASE_SSL_CA_FILE: path.join(dir, "none"),
      }),
    ).toThrow(/cannot read/);
    expect(() =>
      pgConnectionOptions({ DATABASE_URL: url, DATABASE_SSL: false, DATABASE_SSL_CA_FILE: bad }),
    ).toThrow(/requires DATABASE_SSL=true/);
  });
});
