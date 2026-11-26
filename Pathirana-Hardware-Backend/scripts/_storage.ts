import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { SupabaseMediaStorage } from "../src/media/media-storage";

export interface StorageTarget {
  url: string;
  secretKey: string;
  catalogueBucket: string;
  privateBucket: string;
}

/** Reads the Supabase Storage settings from ONE env file (never printed). */
export function loadStorageTarget(envFile: string): StorageTarget {
  if (!existsSync(envFile)) throw new Error(`Configuration file not found: ${envFile}`);
  const v = parseEnv(readFileSync(envFile, "utf8"));
  const url = v.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const secretKey = v.SUPABASE_SECRET_KEY?.trim();
  if (!url || !/^https:\/\/[^/\s?#]+$/.test(url))
    throw new Error(`Set SUPABASE_URL (https://<ref>.supabase.co) in ${envFile}.`);
  if (!secretKey || secretKey.length < 20)
    throw new Error(`Set SUPABASE_SECRET_KEY (server-only secret key) in ${envFile}.`);
  if (secretKey.startsWith("sb_publishable_"))
    throw new Error("SUPABASE_SECRET_KEY is a publishable key; use a secret key.");
  return {
    url,
    secretKey,
    catalogueBucket: v.SUPABASE_CATALOGUE_BUCKET?.trim() || "catalogue-media",
    privateBucket: v.SUPABASE_PRIVATE_BUCKET?.trim() || "quotation-photos",
  };
}

export function storageClient(t: StorageTarget) {
  return new SupabaseMediaStorage({
    url: t.url,
    secretKey: t.secretKey,
    catalogueBucket: t.catalogueBucket,
    privateBucket: t.privateBucket,
  });
}

/** Calls the Storage admin API (bucket management) with the secret key; returns status + JSON. */
export async function storageApi(t: StorageTarget, method: string, path: string, body?: unknown) {
  const client = storageClient(t);
  const res = await fetch(`${t.url}/storage/v1${path}`, {
    method,
    headers: client.headers(body ? { "content-type": "application/json" } : {}),
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, ok: res.ok, json };
}

/** Removes the secret key and project URL from messages. */
export function redactStorage(message: string, t?: StorageTarget) {
  let out = message;
  if (t) for (const s of [t.secretKey, t.url]) out = out.split(s).join("***");
  return out
    .replace(/sb_secret_[A-Za-z0-9_-]+/g, "sb_secret_***")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_.-]+/g, "***");
}
