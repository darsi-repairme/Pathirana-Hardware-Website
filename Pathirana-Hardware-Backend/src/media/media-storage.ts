import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Global, Module } from "@nestjs/common";
import { ENV, type Env } from "../config/env";

/**
 * Where uploaded media lives. The API is the ONLY gatekeeper: every read goes through a
 * route that first checks the database (published product, active brand/category, or a
 * signed-in staff member for quotation photos). Storage itself is never public.
 *
 *  - catalogue areas (products, brands, categories) → the catalogue bucket
 *  - quotations (customer reference photos)          → the separate private bucket
 *  - staff (profile photos, staff-only reads)        → the catalogue bucket, path staff/…
 */
export type MediaArea =
  "products" | "brands" | "categories" | "services" | "gallery" | "quotations" | "staff";
const AREAS = new Set<MediaArea>([
  "products",
  "brands",
  "categories",
  "services",
  "gallery",
  "quotations",
  "staff",
]);
/** Only server-generated names: <uuid>.webp or <uuid>-thumb.webp (no paths, no user input). */
const NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(-thumb)?\.webp$/;

export interface MediaStorage {
  readonly kind: "local" | "supabase";
  /** Create-only: fails with MediaConflictError if the object already exists. */
  put(area: MediaArea, name: string, data: Buffer): Promise<void>;
  /** The object's bytes, or null when it does not exist. */
  get(area: MediaArea, name: string): Promise<Buffer | null>;
  /** Removes objects; missing ones are ignored. */
  remove(area: MediaArea, names: string[]): Promise<void>;
}

export const MEDIA_STORAGE = Symbol("MEDIA_STORAGE");

export class MediaConflictError extends Error {
  constructor() {
    super("A media object with this name already exists.");
  }
}

/** Storage failure. The message never contains credentials or response bodies. */
export class MediaStorageError extends Error {}

function checkName(area: MediaArea, name: string) {
  if (!AREAS.has(area) || !NAME.test(name)) throw new MediaStorageError("Invalid media object name.");
}

/** Files under UPLOAD_DIR/<area>/ (outside any web root) — the original behaviour. */
export class LocalMediaStorage implements MediaStorage {
  readonly kind = "local" as const;
  constructor(private readonly root: string) {}

  private file(area: MediaArea, name: string) {
    checkName(area, name);
    return path.join(path.resolve(this.root, area), name);
  }

  async put(area: MediaArea, name: string, data: Buffer) {
    const file = this.file(area, name);
    await mkdir(path.dirname(file), { recursive: true });
    try {
      await writeFile(file, data, { flag: "wx" });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EEXIST") throw new MediaConflictError();
      throw e;
    }
  }

  async get(area: MediaArea, name: string) {
    try {
      return await readFile(this.file(area, name));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }

  async remove(area: MediaArea, names: string[]) {
    await Promise.all(names.map((n) => rm(this.file(area, n), { force: true })));
  }
}

export interface SupabaseStorageOptions {
  url: string;
  /** Backend-only secret (sb_secret_… or the legacy service_role key). Never sent to browsers. */
  secretKey: string;
  catalogueBucket: string;
  privateBucket: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Supabase Storage over its REST API, from the server only. Both buckets are PRIVATE;
 * objects are read with the secret key through /object/authenticated and streamed by
 * the API after its own authorisation check. Uploads never overwrite (x-upsert: false).
 */
export class SupabaseMediaStorage implements MediaStorage {
  readonly kind = "supabase" as const;
  private readonly base: string;
  private readonly fetch: typeof fetch;

  constructor(private readonly o: SupabaseStorageOptions) {
    this.base = `${o.url.replace(/\/+$/, "")}/storage/v1`;
    this.fetch = o.fetchImpl ?? fetch;
  }

  bucketFor(area: MediaArea) {
    return area === "quotations" ? this.o.privateBucket : this.o.catalogueBucket;
  }

  private objectPath(area: MediaArea, name: string) {
    checkName(area, name);
    return `${area}/${name}`;
  }

  /** New secret keys go in `apikey` only; a legacy service_role JWT also as Bearer. */
  headers(extra: Record<string, string> = {}): Record<string, string> {
    const key = this.o.secretKey;
    return key.startsWith("sb_secret_")
      ? { apikey: key, ...extra }
      : { apikey: key, authorization: `Bearer ${key}`, ...extra };
  }

  private async call(
    method: string,
    url: string,
    init: { headers?: Record<string, string>; body?: Uint8Array | string },
  ) {
    try {
      return await this.fetch(url, {
        method,
        headers: this.headers(init.headers),
        body: init.body,
        signal: AbortSignal.timeout(this.o.timeoutMs ?? 15_000),
      });
    } catch (e) {
      throw new MediaStorageError(`Media storage unreachable (${(e as Error).name}).`);
    }
  }

  async put(area: MediaArea, name: string, data: Buffer) {
    const res = await this.call(
      "POST",
      `${this.base}/object/${this.bucketFor(area)}/${this.objectPath(area, name)}`,
      {
        headers: { "content-type": "image/webp", "x-upsert": "false", "cache-control": "max-age=31536000" },
        body: new Uint8Array(data),
      },
    );
    if (res.ok) return;
    const text = await res.text().catch(() => "");
    if (res.status === 409 || /duplicate|already exists/i.test(text)) throw new MediaConflictError();
    throw new MediaStorageError(`Media upload failed (HTTP ${res.status}).`);
  }

  async get(area: MediaArea, name: string) {
    const res = await this.call(
      "GET",
      `${this.base}/object/authenticated/${this.bucketFor(area)}/${this.objectPath(area, name)}`,
      {},
    );
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const text = await res.text().catch(() => "");
    if (res.status === 404 || (res.status === 400 && /not.?found/i.test(text))) return null;
    throw new MediaStorageError(`Media read failed (HTTP ${res.status}).`);
  }

  async remove(area: MediaArea, names: string[]) {
    if (!names.length) return;
    const res = await this.call("DELETE", `${this.base}/object/${this.bucketFor(area)}`, {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prefixes: names.map((n) => this.objectPath(area, n)) }),
    });
    if (!res.ok) throw new MediaStorageError(`Media delete failed (HTTP ${res.status}).`);
  }
}

export function createMediaStorage(env: Env): MediaStorage {
  if (env.MEDIA_STORAGE === "supabase") {
    return new SupabaseMediaStorage({
      url: env.SUPABASE_URL!,
      secretKey: env.SUPABASE_SECRET_KEY!,
      catalogueBucket: env.SUPABASE_CATALOGUE_BUCKET,
      privateBucket: env.SUPABASE_PRIVATE_BUCKET,
    });
  }
  return new LocalMediaStorage(env.UPLOAD_DIR);
}

@Global()
@Module({
  providers: [{ provide: MEDIA_STORAGE, inject: [ENV], useFactory: createMediaStorage }],
  exports: [MEDIA_STORAGE],
})
export class MediaStorageModule {}
