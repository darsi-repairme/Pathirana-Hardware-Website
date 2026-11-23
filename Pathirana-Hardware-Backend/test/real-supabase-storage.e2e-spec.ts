import { createHash, randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import type { Client } from "pg";
import sharp from "sharp";
import request from "supertest";
import { loadStorageTarget, storageClient, type StorageTarget } from "../scripts/_storage";
import { MediaConflictError, type SupabaseMediaStorage } from "../src/media/media-storage";
import { createStaff, createTestApp, login } from "./helpers";

/**
 * OPT-IN test against the REAL Supabase Storage buckets (skipped unless
 * REAL_STORAGE_ENV_FILE points to the git-ignored config, e.g. .env.supabase).
 * The database is the usual isolated throwaway one: nothing is written to the permanent
 * database. Only temporary test objects are created, and exactly those are removed again;
 * existing media is never touched.
 */
const envFile = process.env.REAL_STORAGE_ENV_FILE;
const describeReal = envFile ? describe : describe.skip;
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

describeReal("REAL Supabase Storage (private buckets)", () => {
  let t: StorageTarget;
  let s: SupabaseMediaStorage;
  const created: { area: "brands" | "products" | "quotations"; name: string }[] = [];
  let before: { cat: string[]; priv: string[] };

  async function list(bucket: string): Promise<string[]> {
    const out: string[] = [];
    for (const prefix of ["brands", "products", "categories", "quotations"]) {
      const res = await fetch(`${t.url}/storage/v1/object/list/${bucket}`, {
        method: "POST",
        headers: s.headers({ "content-type": "application/json" }),
        body: JSON.stringify({ prefix, limit: 1000 }),
      });
      expect(res.ok).toBe(true);
      for (const o of (await res.json()) as { name: string; id: string | null }[])
        if (o.id) out.push(`${prefix}/${o.name}`);
    }
    return out.sort();
  }
  const noKey = (path: string) => fetch(`${t.url}/storage/v1/object/authenticated/${path}`);
  const publicUrl = (path: string) => fetch(`${t.url}/storage/v1/object/public/${path}`);

  beforeAll(async () => {
    t = loadStorageTarget(envFile!);
    s = storageClient(t);
    before = { cat: await list(t.catalogueBucket), priv: await list(t.privateBucket) };
  });
  afterAll(async () => {
    for (const c of created) await s.remove(c.area, [c.name]).catch(() => undefined);
    // Exactly the media that existed before remains.
    expect({ cat: await list(t.catalogueBucket), priv: await list(t.privateBucket) }).toEqual(before);
  });

  it("client: create-only upload, checksum round trip, no public or keyless access, WebP only", async () => {
    for (const area of ["brands", "quotations"] as const) {
      const name = `${randomUUID()}.webp`;
      const data = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#123456" } })
        .webp()
        .toBuffer();
      await s.put(area, name, data);
      created.push({ area, name });
      await expect(s.put(area, name, Buffer.from("other"))).rejects.toBeInstanceOf(MediaConflictError);
      expect(sha((await s.get(area, name))!)).toBe(sha(data)); // never overwritten
      const path = `${s.bucketFor(area)}/${area}/${name}`;
      expect((await publicUrl(path)).ok).toBe(false);
      expect((await noKey(path)).ok).toBe(false);
    }
    // Bucket policy: only image/webp is accepted.
    const png = await fetch(`${t.url}/storage/v1/object/${t.catalogueBucket}/brands/${randomUUID()}.webp`, {
      method: "POST",
      headers: s.headers({ "content-type": "image/png", "x-upsert": "false" }),
      body: new Uint8Array(Buffer.from("not webp")),
    });
    expect(png.ok).toBe(false);
    expect(await s.get("brands", `${randomUUID()}.webp`)).toBeNull();
  });

  describe("through the API (isolated database)", () => {
    let app: INestApplication;
    let db: Client;
    let http: ReturnType<typeof request>;
    let auth: { Authorization: string };
    beforeAll(async () => {
      ({ app, db } = await createTestApp({
        TRUST_PROXY: "true",
        MEDIA_STORAGE: "supabase",
        SUPABASE_URL: t.url,
        SUPABASE_SECRET_KEY: t.secretKey,
        SUPABASE_CATALOGUE_BUCKET: t.catalogueBucket,
        SUPABASE_PRIVATE_BUCKET: t.privateBucket,
      }));
      http = request(app.getHttpServer());
      await createStaff(db, "real-storage-editor@test.invalid", "editor", "Real-Storage-Editor-9");
      auth = {
        Authorization: `Bearer ${await login(app, "real-storage-editor@test.invalid", "Real-Storage-Editor-9")}`,
      };
    });
    afterAll(async () => {
      await app?.close();
      await db?.end();
    });

    it("brand logo: stored privately, served by the API only while active, removed on delete", async () => {
      const png = await sharp({ create: { width: 300, height: 120, channels: 4, background: "#0f5d3aff" } })
        .png()
        .toBuffer();
      const id = (
        await http.post("/api/v1/admin/brands").set(auth).send({ name: "Real Storage Test" }).expect(201)
      ).body.id;
      const key = (
        await http.post(`/api/v1/admin/brands/${id}/logo`).set(auth).attach("file", png, "l.png").expect(201)
      ).body.logoKey as string;
      created.push({ area: "brands", name: `${key}.webp` });
      const stored = (await s.get("brands", `${key}.webp`))!;
      const served = await http.get(`/api/v1/brand-logos/${key}`).buffer(true).expect(200);
      expect(sha(served.body)).toBe(sha(stored));
      expect((await publicUrl(`${t.catalogueBucket}/brands/${key}.webp`)).ok).toBe(false);
      await http.patch(`/api/v1/admin/brands/${id}/status`).set(auth).send({ isActive: false }).expect(200);
      await http.get(`/api/v1/brand-logos/${key}`).expect(404);
      await http.delete(`/api/v1/admin/brands/${id}/logo`).set(auth).expect(204);
      expect(await s.get("brands", `${key}.webp`)).toBeNull();
    });

    it("quotation photos: private bucket, anonymous 401, staff 200, never public", async () => {
      await http
        .post("/api/v1/admin/delivery-areas")
        .set(auth)
        .send({ name: "Real Storage Area" })
        .expect(201);
      const photo = await sharp({ create: { width: 640, height: 480, channels: 3, background: "#b8860b" } })
        .jpeg()
        .toBuffer();
      await http
        .post("/api/v1/quotations")
        .set("X-Forwarded-For", "10.66.0.1")
        .field(
          "data",
          JSON.stringify({
            idempotencyKey: randomUUID(),
            customerName: "Test Customer",
            phone: "0712345678",
            location: "Real Storage Area",
            fulfilment: "collection",
            contactConsent: true,
            items: [{ productName: "Test Cement", quantity: "1" }],
          }),
        )
        .attach("photos", photo, { filename: "p.jpg", contentType: "image/jpeg" })
        .expect(201);
      const row = (await db.query("SELECT quotation_id, id, storage_key FROM quotation_photos")).rows[0];
      for (const n of [`${row.storage_key}.webp`, `${row.storage_key}-thumb.webp`])
        created.push({ area: "quotations", name: n });
      const stored = (await s.get("quotations", `${row.storage_key}.webp`))!;
      expect(stored).not.toBeNull();
      expect(await s.get("brands", `${row.storage_key}.webp`)).toBeNull(); // not in the catalogue bucket

      const url = `/api/v1/admin/quotations/${row.quotation_id}/photos/${row.id}`;
      await http.get(url).expect(401);
      const got = await http.get(url).set(auth).buffer(true).expect(200);
      expect(sha(got.body)).toBe(sha(stored));
      expect(got.headers["cache-control"]).toBe("private, no-store");
      const path = `${t.privateBucket}/quotations/${row.storage_key}.webp`;
      expect((await publicUrl(path)).ok).toBe(false);
      expect((await noKey(path)).ok).toBe(false);
    });
  });
});
