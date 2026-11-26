import { createHash, randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import type { Client } from "pg";
import sharp from "sharp";
import request from "supertest";
import { MediaConflictError, SupabaseMediaStorage } from "../src/media/media-storage";
import { FakeSupabaseStorage } from "./fake-supabase-storage";
import { createStaff, createTestApp, login } from "./helpers";

/**
 * MEDIA_STORAGE=supabase against a LOCAL fake of the Storage REST API (no cloud call).
 * Isolated throwaway database — every record here is TEST data.
 */
const SECRET = "sb_secret_test_only_0123456789abcdefghij";
const CAT = "catalogue-media";
const PRIV = "quotation-photos";
const EDITOR = { email: "cloud-media-editor@test.invalid", password: "Cloud-Media-Editor-9" };
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
let ip = 0;
const nextIp = () => `10.88.${Math.floor(++ip / 200)}.${ip % 200}`;

describe("Supabase media storage (private buckets, API-gated)", () => {
  const fake = new FakeSupabaseStorage(SECRET, [CAT, PRIV]);
  let app: INestApplication;
  let db: Client;
  let http: ReturnType<typeof request>;
  let auth: { Authorization: string };
  let png: Buffer;

  beforeAll(async () => {
    await fake.start();
    ({ app, db } = await createTestApp({
      TRUST_PROXY: "true",
      MEDIA_STORAGE: "supabase",
      SUPABASE_URL: fake.url,
      SUPABASE_SECRET_KEY: SECRET,
      SUPABASE_CATALOGUE_BUCKET: CAT,
      SUPABASE_PRIVATE_BUCKET: PRIV,
    }));
    http = request(app.getHttpServer());
    await createStaff(db, EDITOR.email, "editor", EDITOR.password);
    auth = { Authorization: `Bearer ${await login(app, EDITOR.email, EDITOR.password)}` };
    png = await sharp({ create: { width: 900, height: 600, channels: 4, background: "#0f5d3aff" } })
      .png()
      .toBuffer();
  });
  afterAll(async () => {
    await app?.close();
    await db?.end();
    await fake.stop();
  });

  it("brand logo: stored in the catalogue bucket, public only while active, replace and remove clean up", async () => {
    const id = (
      await http.post("/api/v1/admin/brands").set(auth).send({ name: "Cloud Test Brand" }).expect(201)
    ).body.id as string;
    const up = await http
      .post(`/api/v1/admin/brands/${id}/logo`)
      .set(auth)
      .attach("file", png, "logo.png")
      .expect(201);
    const key = up.body.logoKey as string;
    expect(fake.inBucket(CAT)).toEqual([`brands/${key}.webp`]);
    expect(fake.inBucket(PRIV)).toEqual([]);

    const pub = await http.get(`/api/v1/brand-logos/${key}`).buffer(true).expect(200);
    expect(pub.headers["content-type"]).toBe("image/webp");
    expect(sha(pub.body)).toBe(sha(fake.objects.get(`${CAT}/brands/${key}.webp`)!));
    expect((await sharp(pub.body).metadata()).width).toBe(800); // lossless logo pipeline, max 800

    // Inactive brand → not public (staff can still preview).
    await http.patch(`/api/v1/admin/brands/${id}/status`).set(auth).send({ isActive: false }).expect(200);
    await http.get(`/api/v1/brand-logos/${key}`).expect(404);
    await http.get(`/api/v1/admin/brands/${id}/logo`).set(auth).expect(200);
    await http.get(`/api/v1/admin/brands/${id}/logo`).expect(401);
    await http.patch(`/api/v1/admin/brands/${id}/status`).set(auth).send({ isActive: true }).expect(200);

    // Replace: new object, old one deleted; remove: object deleted, reference cleared.
    const re = await http
      .post(`/api/v1/admin/brands/${id}/logo`)
      .set(auth)
      .attach("file", png, "l2.png")
      .expect(201);
    const key2 = re.body.logoKey as string;
    expect(key2).not.toBe(key);
    expect(fake.inBucket(CAT)).toEqual([`brands/${key2}.webp`]);
    await http.get(`/api/v1/brand-logos/${key}`).expect(404);
    await http.delete(`/api/v1/admin/brands/${id}/logo`).set(auth).expect(204);
    expect(fake.inBucket(CAT)).toEqual([]);
    expect((await db.query("SELECT logo_key FROM brands WHERE id = $1", [id])).rows[0].logo_key).toBeNull();
  });

  it("product images: drafts never public; published images served from the catalogue bucket", async () => {
    const cat = (
      await http.post("/api/v1/admin/categories").set(auth).send({ name: "Cloud Steel" }).expect(201)
    ).body;
    const prod = (
      await http
        .post("/api/v1/admin/products")
        .set(auth)
        .send({ name: "Cloud TOR Bars", categoryId: cat.id })
        .expect(201)
    ).body;
    const img = await http
      .post(`/api/v1/admin/products/${prod.id}/images`)
      .set(auth)
      .attach("file", png, "p.png")
      .field("altText", "Test bars")
      .expect(201);
    const key = (await db.query("SELECT storage_key FROM product_images WHERE id = $1", [img.body.id]))
      .rows[0].storage_key as string;
    expect(fake.inBucket(CAT).sort()).toEqual([`products/${key}-thumb.webp`, `products/${key}.webp`]);

    await http.get(`/api/v1/product-images/${img.body.id}`).expect(404); // draft product
    await http.get(`/api/v1/admin/products/${prod.id}/images/${img.body.id}`).set(auth).expect(200);
    await http
      .patch(`/api/v1/admin/products/${prod.id}/publication`)
      .set(auth)
      .send({ published: true })
      .expect(200);
    const thumb = await http.get(`/api/v1/product-images/${img.body.id}?size=thumb`).buffer(true).expect(200);
    expect((await sharp(thumb.body).metadata()).width).toBe(480);

    await http.delete(`/api/v1/admin/products/${prod.id}/images/${img.body.id}`).set(auth).expect(204);
    expect(fake.inBucket(CAT)).toEqual([]);
  });

  it("quotation photos: private bucket only, staff-only reads, never public", async () => {
    await http.post("/api/v1/admin/delivery-areas").set(auth).send({ name: "Cloud Test Area" }).expect(201);
    const photo = await sharp({ create: { width: 2000, height: 1500, channels: 3, background: "#b8860b" } })
      .jpeg()
      .toBuffer();
    const data = {
      idempotencyKey: randomUUID(),
      customerName: "Test Customer",
      phone: "0712345678",
      location: "Cloud Test Area",
      fulfilment: "collection",
      contactConsent: true,
      items: [{ productName: "Test Cement", quantity: "1" }],
    };
    await http
      .post("/api/v1/quotations")
      .set("X-Forwarded-For", nextIp())
      .field("data", JSON.stringify(data))
      .attach("photos", photo, { filename: "p.jpg", contentType: "image/jpeg" })
      .expect(201);
    const row = (await db.query("SELECT quotation_id, id, storage_key FROM quotation_photos")).rows[0];
    expect(fake.inBucket(PRIV).sort()).toEqual([
      `quotations/${row.storage_key}-thumb.webp`,
      `quotations/${row.storage_key}.webp`,
    ]);
    expect(fake.inBucket(CAT).some((k) => k.startsWith("quotations/"))).toBe(false);

    const url = `/api/v1/admin/quotations/${row.quotation_id}/photos/${row.id}`;
    await http.get(url).expect(401);
    await http.get(url).set("Authorization", "Bearer not-a-token").expect(401);
    const got = await http.get(url).set(auth).buffer(true).expect(200);
    expect(got.headers["cache-control"]).toBe("private, no-store");
    expect(sha(got.body)).toBe(sha(fake.objects.get(`${PRIV}/quotations/${row.storage_key}.webp`)!));

    // Storage itself refuses public access to the private object.
    const direct = await fetch(
      `${fake.url}/storage/v1/object/public/${PRIV}/quotations/${row.storage_key}.webp`,
      { headers: { "x-test-probe": "1" } },
    );
    expect(direct.status).toBe(400);
    const noKey = await fetch(
      `${fake.url}/storage/v1/object/authenticated/${PRIV}/quotations/${row.storage_key}.webp`,
      { headers: { "x-test-probe": "1" } },
    );
    expect(noKey.status).toBe(403);
  });

  it("storage outage: 503, nothing written to the database; the secret key never leaves the server", async () => {
    const id = (await http.post("/api/v1/admin/brands").set(auth).send({ name: "Outage Brand" }).expect(201))
      .body.id;
    fake.down = true;
    try {
      const res = await http
        .post(`/api/v1/admin/brands/${id}/logo`)
        .set(auth)
        .attach("file", png, "x.png")
        .expect(503);
      expect(JSON.stringify(res.body)).not.toContain(SECRET);
      expect((await db.query("SELECT logo_key FROM brands WHERE id = $1", [id])).rows[0].logo_key).toBeNull();
    } finally {
      fake.down = false;
    }
    // New-style secret keys go only in the apikey header (never as a Bearer token).
    expect(fake.seenHeaders.length).toBeGreaterThan(0);
    // (Requests the API made; the test's own keyless probes are tagged and skipped.)
    for (const h of fake.seenHeaders.filter((x) => !x["x-test-probe"])) {
      expect(h.apikey).toBe(SECRET);
      expect(h.authorization).toBeUndefined();
    }
    const list = await http.get("/api/v1/brands").expect(200);
    expect(JSON.stringify(list.body) + JSON.stringify(list.headers)).not.toContain(SECRET);
  });

  it("client: create-only uploads, missing objects, name validation, legacy key headers", async () => {
    const s = new SupabaseMediaStorage({
      url: fake.url,
      secretKey: SECRET,
      catalogueBucket: CAT,
      privateBucket: PRIV,
    });
    const name = `${randomUUID()}.webp`;
    await s.put("brands", name, Buffer.from("one"));
    await expect(s.put("brands", name, Buffer.from("two"))).rejects.toBeInstanceOf(MediaConflictError);
    expect((await s.get("brands", name))!.toString()).toBe("one"); // never overwritten
    expect(await s.get("brands", `${randomUUID()}.webp`)).toBeNull();
    await expect(s.get("brands", "../../etc/passwd")).rejects.toThrow(/Invalid media object name/);
    await s.remove("brands", [name]);
    expect(await s.get("brands", name)).toBeNull();
    const legacy = new SupabaseMediaStorage({
      url: fake.url,
      secretKey: "eyJlegacy.jwt.value",
      catalogueBucket: CAT,
      privateBucket: PRIV,
    });
    expect(legacy.headers()).toEqual({
      apikey: "eyJlegacy.jwt.value",
      authorization: "Bearer eyJlegacy.jwt.value",
    });
  });
});
