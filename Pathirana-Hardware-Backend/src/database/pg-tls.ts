import { readFileSync } from "node:fs";
import type { ConnectionOptions } from "node:tls";

/** Connection settings shared by the API and the command-line scripts. */
export interface PgTlsSettings {
  DATABASE_URL: string;
  DATABASE_SSL: boolean;
  /** PEM file with the CA that signed the server certificate (e.g. Supabase's root CA). */
  DATABASE_SSL_CA_FILE?: string;
}

/**
 * URL parameters that make `pg` REPLACE the `ssl` object passed in code (so a pinned
 * CA would be dropped silently). With DATABASE_SSL=true they are removed and TLS is
 * configured only here.
 */
const URL_TLS_PARAMS = [
  "sslmode",
  "ssl",
  "sslrootcert",
  "sslcert",
  "sslkey",
  "sslpassword",
  "uselibpqcompat",
];

const PEM_CERT = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/;

/** Reads and checks a CA file; the message names the problem, never the file contents. */
export function readCaFile(file: string): string {
  let pem: string;
  try {
    pem = readFileSync(file, "utf8");
  } catch {
    throw new Error(`DATABASE_SSL_CA_FILE: cannot read ${file}`);
  }
  if (!PEM_CERT.test(pem)) throw new Error(`DATABASE_SSL_CA_FILE: ${file} is not a PEM certificate`);
  return pem;
}

/**
 * pg Pool/Client options. With DATABASE_SSL=true the server certificate is ALWAYS
 * verified (chain + host name); with a CA file only that CA is trusted. Verification
 * is never switched off. With DATABASE_SSL=false the URL is used unchanged (local DB).
 */
export function pgConnectionOptions(s: PgTlsSettings): { connectionString: string; ssl?: ConnectionOptions } {
  if (!s.DATABASE_SSL) {
    if (s.DATABASE_SSL_CA_FILE) throw new Error("DATABASE_SSL_CA_FILE requires DATABASE_SSL=true");
    return { connectionString: s.DATABASE_URL };
  }
  const url = new URL(s.DATABASE_URL);
  for (const p of URL_TLS_PARAMS) url.searchParams.delete(p);
  const ssl: ConnectionOptions = { rejectUnauthorized: true };
  if (s.DATABASE_SSL_CA_FILE) ssl.ca = readCaFile(s.DATABASE_SSL_CA_FILE);
  return { connectionString: url.toString(), ssl };
}
