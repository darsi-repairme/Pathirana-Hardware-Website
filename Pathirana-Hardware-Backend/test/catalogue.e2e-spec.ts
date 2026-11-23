import type { INestApplication } from "@nestjs/common";
import type { Client } from "pg";
import sharp from "sharp";
import request from "supertest";
import { createStaff, createTestApp, login } from "./helpers";

const EDITOR = { email: "catalogue-editor@test.invalid", password: "Catalogue-Editor-77" };

describe("Catalogue: categories, brands, products, images", () => {
  let app: INestApplication;
  let db: Client;
  let http: ReturnType<typeof request>;
  let auth: { Authorization: string };

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    http = request(app.getHttpServer());
    await createStaff(db, EDITOR.email, "editor", EDITOR.password);
    auth = { Authorization: `Bearer ${await login(app, EDITOR.email, EDITOR.password)}` };
  });
  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  let steelId = "";
  let plywoodId = "";
  let brandId = "";
  let torId = "";

  it("creates, updates and deactivates categories (public list shows active only)", async () => {
    const steel = await http
      .post("/api/v1/admin/categories")
      .set(auth)
      .send({ name: "Steel Products" })
      .expect(201);
    expect(steel.body).toMatchObject({ slug: "steel-products", isActive: true });
    steelId = steel.body.id;
    const ply = await http
      .post("/api/v1/admin/categories")
      .set(auth)
      .send({ name: "Plywood", sortOrder: 2 })
      .expect(201);
    plywoodId = ply.body.id;
    await http.post("/api/v1/admin/categories").set(auth).send({ name: "steel products" }).expect(409);
    await http.post("/api/v1/admin/categories").set(auth).send({ name: "" }).expect(400);

    await http
      .patch(`/api/v1/admin/categories/${steelId}`)
      .set(auth)
      .send({ description: "TOR bars and box bars." })
      .expect(200);
    await http.patch(`/api/v1/admin/categories/${steelId}`).set(auth).send({}).expect(400);
    await http
      .patch(`/api/v1/admin/categories/${plywoodId}/status`)
      .set(auth)
      .send({ isActive: false })
      .expect(200);

    const pub = await http.get("/api/v1/categories").expect(200);
    expect(pub.body.items.map((c: { slug: string }) => c.slug)).toEqual(["steel-products"]);
    expect(pub.body.items[0]).not.toHaveProperty("id");
    await http
      .patch(`/api/v1/admin/categories/${plywoodId}/status`)
      .set(auth)
      .send({ isActive: true })
      .expect(200);
  });

  it("creates, updates and deactivates brands", async () => {
    const b = await http.post("/api/v1/admin/brands").set(auth).send({ name: "Würth" }).expect(201);
    expect(b.body.slug).toBe("wurth");
    brandId = b.body.id;
    const pe = await http.post("/api/v1/admin/brands").set(auth).send({ name: "PE+" }).expect(201);
    expect(pe.body.slug).toBe("pe-plus");
    await http.patch(`/api/v1/admin/brands/${pe.body.id}`).set(auth).send({ name: "PE Plus" }).expect(200);
    await http
      .patch(`/api/v1/admin/brands/${pe.body.id}/status`)
      .set(auth)
      .send({ isActive: false })
      .expect(200);
    const pub = await http.get("/api/v1/brands").expect(200);
    expect(pub.body.items).toEqual([{ slug: "wurth", name: "Würth", logo: null }]);
  });

  it("creates products unpublished; publishes; searches and filters", async () => {
    const tor = await http
      .post("/api/v1/admin/products")
      .set(auth)
      .send({
        name: "TOR Bars",
        categoryId: steelId,
        summary: "Steel bars.",
        searchTerms: ["Rebar", " TOR "],
      })
      .expect(201);
    torId = tor.body.id;
    expect(tor.body).toMatchObject({
      slug: "tor-bars",
      isPublished: false,
      searchTerms: ["rebar", "tor"],
      brands: [],
    });
    await http
      .post("/api/v1/admin/products")
      .set(auth)
      .send({ name: "Box Bars", categoryId: steelId, price: 100 })
      .expect(400); // unknown fields (e.g. invented prices) are rejected
    const box = await http
      .post("/api/v1/admin/products")
      .set(auth)
      .send({ name: "Box Bars", categoryId: steelId })
      .expect(201);
    const ply = await http
      .post("/api/v1/admin/products")
      .set(auth)
      .send({ name: "Plywood", categoryId: plywoodId })
      .expect(201);

    // Nothing public until published.
    expect((await http.get("/api/v1/products").expect(200)).body).toMatchObject({ items: [], total: 0 });
    await http.get("/api/v1/products/tor-bars").expect(404);

    for (const id of [torId, box.body.id, ply.body.id]) {
      await http
        .patch(`/api/v1/admin/products/${id}/publication`)
        .set(auth)
        .send({ published: true })
        .expect(200);
    }
    const all = await http.get("/api/v1/products").expect(200);
    expect(all.body.total).toBe(3);
    expect(all.body.items.map((p: { name: string }) => p.name)).toEqual(["Box Bars", "Plywood", "TOR Bars"]);
    expect(all.body.items[0]).not.toHaveProperty("id");

    const search = await http.get("/api/v1/products").query({ q: "rebar" }).expect(200);
    expect(search.body.items.map((p: { slug: string }) => p.slug)).toEqual(["tor-bars"]);
    const wildcard = await http.get("/api/v1/products").query({ q: "%" }).expect(200);
    expect(wildcard.body.total).toBe(0); // LIKE wildcards are matched literally
    const cat = await http
      .get("/api/v1/products")
      .query({ category: "steel-products", limit: 1, page: 2 })
      .expect(200);
    expect(cat.body).toMatchObject({ total: 2, page: 2, limit: 1 });
    await http.get("/api/v1/products").query({ limit: 500 }).expect(400);

    // Brand filter only matches confirmed links set by staff.
    expect((await http.get("/api/v1/products").query({ brand: "wurth" }).expect(200)).body.total).toBe(0);
    await http
      .patch(`/api/v1/admin/products/${ply.body.id}`)
      .set(auth)
      .send({ brandIds: [brandId] })
      .expect(200);
    const byBrand = await http.get("/api/v1/products").query({ brand: "wurth" }).expect(200);
    expect(byBrand.body.items).toHaveLength(1);
    expect(byBrand.body.items[0].brands).toEqual([{ slug: "wurth", name: "Würth" }]);

    // Detail + unpublish + inactive category hides products.
    const detail = await http.get("/api/v1/products/tor-bars").expect(200);
    expect(detail.body).toMatchObject({ name: "TOR Bars", category: { slug: "steel-products" }, images: [] });
    await http
      .patch(`/api/v1/admin/products/${box.body.id}/publication`)
      .set(auth)
      .send({ published: false })
      .expect(200);
    await http.get("/api/v1/products/box-bars").expect(404);
    await http
      .patch(`/api/v1/admin/categories/${plywoodId}/status`)
      .set(auth)
      .send({ isActive: false })
      .expect(200);
    expect((await http.get("/api/v1/products").expect(200)).body.total).toBe(1);
    await http
      .patch(`/api/v1/admin/categories/${plywoodId}/status`)
      .set(auth)
      .send({ isActive: true })
      .expect(200);

    const admin = await http.get("/api/v1/admin/products").query({ status: "draft" }).set(auth).expect(200);
    expect(admin.body.items.map((p: { slug: string }) => p.slug)).toEqual(["box-bars"]);
    const audit = await db.query("SELECT count(*)::int AS n FROM audit_log WHERE entity_type = 'product'");
    expect(audit.rows[0].n).toBeGreaterThanOrEqual(8);
  });

  it("validates, stores and serves product images safely", async () => {
    const png = await sharp({ create: { width: 2400, height: 1800, channels: 3, background: "#0f5d3a" } })
      .png()
      .toBuffer();
    // Unauthenticated upload rejected.
    await http
      .post(`/api/v1/admin/products/${torId}/images`)
      .attach("file", png, "a.png")
      .field("altText", "x")
      .expect(401);
    // Text disguised as an image: rejected by content inspection.
    await http
      .post(`/api/v1/admin/products/${torId}/images`)
      .set(auth)
      .attach("file", Buffer.from("#!/bin/sh\nrm -rf /"), { filename: "run.png", contentType: "image/png" })
      .field("altText", "Fake")
      .expect(415);
    // Disallowed type by declared MIME.
    await http
      .post(`/api/v1/admin/products/${torId}/images`)
      .set(auth)
      .attach("file", Buffer.from("<svg/>"), { filename: "x.svg", contentType: "image/svg+xml" })
      .field("altText", "Svg")
      .expect(415);
    // Over the size limit (1 MB in tests). The server rejects with 413 while the
    // client may still be sending, so the socket can also be reset; either way
    // nothing is stored.
    const big = await http
      .post(`/api/v1/admin/products/${torId}/images`)
      .set(auth)
      .attach("file", Buffer.alloc(1.2 * 1024 * 1024, 1), { filename: "big.jpg", contentType: "image/jpeg" })
      .field("altText", "Big")
      .then(
        (r) => r.status,
        (e: NodeJS.ErrnoException) => e.code,
      );
    expect([413, "ECONNRESET", "EPIPE"]).toContain(big);
    expect((await db.query("SELECT 1 FROM product_images WHERE alt_text = 'Big'")).rowCount).toBe(0);
    // Missing alt text.
    await http
      .post(`/api/v1/admin/products/${torId}/images`)
      .set(auth)
      .attach("file", png, "a.png")
      .expect(400);

    const up = await http
      .post(`/api/v1/admin/products/${torId}/images`)
      .set(auth)
      .attach("file", png, "../../evil name.png")
      .field("altText", "Steel bars")
      .expect(201);
    expect(up.body).toMatchObject({ width: 1600, height: 1200, altText: "Steel bars" });
    const key = (await db.query("SELECT storage_key FROM product_images WHERE id = $1", [up.body.id])).rows[0]
      .storage_key;
    expect(key).toMatch(/^[0-9a-f-]{36}$/); // server-generated, not the uploaded name

    const detail = await http.get("/api/v1/products/tor-bars").expect(200);
    expect(detail.body.images).toHaveLength(1);
    const img = await http.get(detail.body.images[0].thumbUrl).expect(200);
    expect(img.headers["content-type"]).toBe("image/webp");
    expect((await sharp(img.body).metadata()).width).toBe(480);

    // Unpublished product → image no longer public.
    await http
      .patch(`/api/v1/admin/products/${torId}/publication`)
      .set(auth)
      .send({ published: false })
      .expect(200);
    await http.get(detail.body.images[0].url).expect(404);
    await http
      .patch(`/api/v1/admin/products/${torId}/publication`)
      .set(auth)
      .send({ published: true })
      .expect(200);

    await http.delete(`/api/v1/admin/products/${torId}/images/${up.body.id}`).set(auth).expect(204);
    await http.get(detail.body.images[0].url).expect(404);
    await http.delete(`/api/v1/admin/products/${torId}/images/${up.body.id}`).set(auth).expect(404);
  });
});
