import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Client } from "pg";
import sharp from "sharp";
import request from "supertest";
import { applyMigrations, MIGRATIONS_DIR } from "../src/database/migrator";
import { colomboToday } from "../src/catalogue/pricing";
import { createStaff, createTestApp, login } from "./helpers";

/**
 * Batch 5A: unit, LKR price, Contact for Price, discounts, availability and
 * main/additional images. All names and prices are TEST DATA in an isolated,
 * throwaway database — never real products.
 */
const EDITOR = { email: "pricing-editor@test.invalid", password: "Pricing-Editor-2026" };
const addDays = (d: string, n: number) => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

describe("Products: pricing, discounts, availability, images", () => {
  let app: INestApplication;
  let db: Client;
  let http: ReturnType<typeof request>;
  let auth: { Authorization: string };
  let categoryId = "";
  let brandId = "";

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    http = request(app.getHttpServer());
    await createStaff(db, EDITOR.email, "editor", EDITOR.password);
    auth = { Authorization: `Bearer ${await login(app, EDITOR.email, EDITOR.password)}` };
    categoryId = (
      await http.post("/api/v1/admin/categories").set(auth).send({ name: "Test Category" }).expect(201)
    ).body.id;
    brandId = (await http.post("/api/v1/admin/brands").set(auth).send({ name: "Test Brand" }).expect(201))
      .body.id;
  });
  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  const create = (body: Record<string, unknown>) =>
    http
      .post("/api/v1/admin/products")
      .set(auth)
      .send({ categoryId, ...body });
  const publish = (id: string, published = true) =>
    http.patch(`/api/v1/admin/products/${id}/publication`).set(auth).send({ published }).expect(200);
  const patch = (id: string, body: Record<string, unknown>) =>
    http.patch(`/api/v1/admin/products/${id}`).set(auth).send(body);

  let pricedId = "";

  it("creates a product with unit and LKR price; defaults are honest", async () => {
    const plain = await create({ name: "Test Plain Item" }).expect(201);
    expect(plain.body).toMatchObject({
      unit: null,
      priceLkr: null,
      contactForPrice: true,
      discountType: "none",
      availability: "on_request",
      isPublished: false,
      price: { contactForPrice: true, original: null, discount: null, final: null },
    });

    const priced = await create({
      name: "Test Priced Item",
      unit: "bag",
      priceLkr: "2500",
      contactForPrice: false,
      availability: "available",
      brandIds: [brandId],
    }).expect(201);
    pricedId = priced.body.id;
    expect(priced.body).toMatchObject({
      unit: "bag",
      priceLkr: "2500.00",
      contactForPrice: false,
      availability: "available",
      price: { original: "2500.00", discount: null, final: "2500.00" },
      discountStatus: "none",
    });
    const audit = await db.query(
      "SELECT details FROM audit_log WHERE action = 'product.create' AND entity_id = $1",
      [pricedId],
    );
    expect(audit.rows[0].details.pricing.priceLkr).toBe("2500");
  });

  it("percentage discount: 10% of LKR 2,500.00 → LKR 2,250.00 (preview = admin = public)", async () => {
    const res = await patch(pricedId, {
      discountType: "percentage",
      discountValue: "10",
      discountEnabled: true,
    }).expect(200);
    expect(res.body.price).toEqual({
      currency: "LKR",
      contactForPrice: false,
      original: "2500.00",
      discount: { type: "percentage", value: "10.00", amount: "250.00", startsOn: null, endsOn: null },
      final: "2250.00",
    });
    expect(res.body.discountStatus).toBe("active");

    const preview = await http
      .post("/api/v1/admin/products/price-preview")
      .set(auth)
      .send({
        priceLkr: "2500.00",
        contactForPrice: false,
        discountType: "percentage",
        discountValue: "10",
        discountEnabled: true,
      })
      .expect(200);
    expect(preview.body).toMatchObject({ valid: true, problems: [], discountStatus: "active" });
    expect(preview.body.price).toEqual(res.body.price);

    await publish(pricedId);
    const pub = await http.get("/api/v1/products/test-priced-item").expect(200);
    expect(pub.body.price).toEqual(res.body.price);
    expect(pub.body).toMatchObject({ unit: "bag", availability: "available" });
    // Raw discount settings never reach the public API.
    for (const k of [
      "priceLkr",
      "discountType",
      "discountValue",
      "discountEnabled",
      "contactForPrice",
      "id",
    ]) {
      expect(pub.body).not.toHaveProperty(k);
    }
    const list = await http.get("/api/v1/products?q=priced").expect(200);
    expect(list.body.items[0].price).toEqual(res.body.price);
  });

  it("fixed LKR discount; rejects invalid percentages and discounts above the price", async () => {
    const fixed = await patch(pricedId, { discountType: "fixed", discountValue: "300.50" }).expect(200);
    expect(fixed.body.price).toMatchObject({
      final: "2199.50",
      discount: { type: "fixed", amount: "300.50" },
    });

    const badPct = await patch(pricedId, { discountType: "percentage", discountValue: "150" }).expect(400);
    expect(badPct.body.message).toContain("A percentage discount must be more than 0 and at most 100.");
    const tooBig = await patch(pricedId, { discountValue: "2500.01" }).expect(400);
    expect(tooBig.body.message).toContain("A fixed discount cannot be more than the original price.");
    // Lowering the price below an existing fixed discount is also rejected.
    await patch(pricedId, { priceLkr: "100" }).expect(400);
    await patch(pricedId, { priceLkr: "-1" }).expect(400);
    await patch(pricedId, { priceLkr: "12.345" }).expect(400);
    await patch(pricedId, { priceLkr: 2500 }).expect(400); // numbers (floats) are not accepted
    // A browser-calculated final price is never accepted.
    await patch(pricedId, { finalPrice: "1.00" }).expect(400);
    await patch(pricedId, { availability: "in_stock" }).expect(400);
    await patch(pricedId, { contactForPrice: null }).expect(400);

    const unchanged = await http.get(`/api/v1/admin/products/${pricedId}`).set(auth).expect(200);
    expect(unchanged.body.price.final).toBe("2199.50");
    // The preview reports problems without saving.
    const preview = await http
      .post("/api/v1/admin/products/price-preview")
      .set(auth)
      .send({ priceLkr: "100", contactForPrice: false, discountType: "fixed", discountValue: "150" })
      .expect(200);
    expect(preview.body).toMatchObject({ valid: false, price: null });
  });

  it("enable/disable, scheduled and expired discounts", async () => {
    const today = colomboToday();
    await patch(pricedId, { discountType: "percentage", discountValue: "10" }).expect(200);

    const off = await patch(pricedId, { discountEnabled: false }).expect(200);
    expect(off.body).toMatchObject({
      discountStatus: "disabled",
      price: { discount: null, final: "2500.00" },
    });
    expect((await http.get("/api/v1/products/test-priced-item")).body.price.discount).toBeNull();

    const scheduled = await patch(pricedId, {
      discountEnabled: true,
      discountStartsOn: addDays(today, 1),
      discountEndsOn: addDays(today, 10),
    }).expect(200);
    expect(scheduled.body).toMatchObject({ discountStatus: "scheduled", price: { final: "2500.00" } });

    // Staff can no longer enter past dates (they get 400); an offer that has run out is simulated
    // by moving the stored dates into the past, as time would.
    await patch(pricedId, {
      discountStartsOn: addDays(today, -10),
      discountEndsOn: addDays(today, -1),
    }).expect(400);
    await db.query("UPDATE products SET discount_starts_on = $2, discount_ends_on = $3 WHERE id = $1", [
      pricedId,
      addDays(today, -10),
      addDays(today, -1),
    ]);
    const expired = await http.get(`/api/v1/admin/products/${pricedId}`).set(auth).expect(200);
    expect(expired.body).toMatchObject({ discountStatus: "expired", price: { discount: null } });
    expect((await http.get("/api/v1/products/test-priced-item")).body.price.final).toBe("2500.00");

    const active = await patch(pricedId, { discountStartsOn: today, discountEndsOn: today }).expect(200);
    expect(active.body).toMatchObject({ discountStatus: "active", price: { final: "2250.00" } });

    const bad = await patch(pricedId, {
      discountStartsOn: addDays(today, 5),
      discountEndsOn: addDays(today, 1),
    }).expect(400);
    expect(bad.body.message).toContain("The discount end date must be on or after the start date.");
    await patch(pricedId, { discountEndsOn: "2026-02-30" }).expect(400);

    // Removing the discount type clears the value and disables it.
    const none = await patch(pricedId, { discountType: "none" }).expect(200);
    expect(none.body).toMatchObject({ discountValue: null, discountEnabled: false, discountStatus: "none" });
  });

  it("Contact for Price hides price and discount everywhere", async () => {
    await patch(pricedId, { discountType: "percentage", discountValue: "10", discountEnabled: true }).expect(
      200,
    );
    const rejected = await patch(pricedId, { contactForPrice: true }).expect(400);
    expect(rejected.body.message[0]).toMatch(/Contact for Price products cannot show a discount/);

    const cfp = await patch(pricedId, { contactForPrice: true, discountEnabled: false }).expect(200);
    expect(cfp.body.priceLkr).toBe("2500.00"); // kept for staff, never shown
    const pub = await http.get("/api/v1/products/test-priced-item").expect(200);
    expect(pub.body.price).toEqual({
      currency: "LKR",
      contactForPrice: true,
      original: null,
      discount: null,
      final: null,
    });
    expect(JSON.stringify(pub.body)).not.toContain("2500");

    await create({ name: "Test No Price", contactForPrice: false }).expect(400);
    await patch(pricedId, { contactForPrice: false, discountEnabled: true }).expect(200);
  });

  it("availability changes; draft products are never public", async () => {
    for (const a of ["out_of_stock", "on_request", "available"]) {
      await patch(pricedId, { availability: a }).expect(200);
      expect((await http.get("/api/v1/products/test-priced-item").expect(200)).body.availability).toBe(a);
    }
    const draft = await create({ name: "Test Draft Item", priceLkr: "10", contactForPrice: false }).expect(
      201,
    );
    await http.get("/api/v1/products/test-draft-item").expect(404);
    expect(
      (await http.get("/api/v1/products").expect(200)).body.items.map((p: { slug: string }) => p.slug),
    ).toEqual(["test-priced-item"]);
    await publish(draft.body.id);
    await http.get("/api/v1/products/test-draft-item").expect(200);
    await publish(draft.body.id, false);
    await http.get("/api/v1/products/test-draft-item").expect(404);
  });

  it("search and category/brand filters on the public API", async () => {
    const q = async (s: string) =>
      (await http.get(`/api/v1/products${s}`).expect(200)).body.items.map((p: { slug: string }) => p.slug);
    expect(await q("?q=priced")).toEqual(["test-priced-item"]);
    expect(await q("?category=test-category")).toEqual(["test-priced-item"]);
    expect(await q("?brand=test-brand")).toEqual(["test-priced-item"]);
    expect(await q("?category=test-category&q=nothing-like-this")).toEqual([]);
    // Search also matches the category and brand names (published products only).
    expect(await q("?q=test%20category")).toEqual(["test-priced-item"]);
    expect(await q("?q=test%20brand")).toEqual(["test-priced-item"]);
  });

  it("main and additional images: first is main, replace main, remove main, public visibility", async () => {
    const png = (c: string) =>
      sharp({ create: { width: 800, height: 600, channels: 3, background: c } })
        .png()
        .toBuffer();
    const up = async (alt: string, isMain?: boolean) => {
      const r = http
        .post(`/api/v1/admin/products/${pricedId}/images`)
        .set(auth)
        .attach("file", await png("#0f5d3a"), "a.png")
        .field("altText", alt);
      if (isMain !== undefined) r.field("isMain", String(isMain));
      return (await r.expect(201)).body;
    };
    const first = await up("Test first");
    expect(first.isMain).toBe(true);
    const second = await up("Test second");
    expect(second.isMain).toBe(false);
    const replacement = await up("Test replacement main", true);
    expect(replacement.isMain).toBe(true);

    let pub = (await http.get("/api/v1/products/test-priced-item").expect(200)).body;
    expect(pub.images.map((i: { alt: string }) => i.alt)).toEqual([
      "Test replacement main",
      "Test first",
      "Test second",
    ]);
    expect(pub.image.alt).toBe("Test replacement main");
    expect((await http.get("/api/v1/products?q=priced")).body.items[0].image.alt).toBe(
      "Test replacement main",
    );

    // Make another image main; edit alt text.
    const patched = await http
      .patch(`/api/v1/admin/products/${pricedId}/images/${second.id}`)
      .set(auth)
      .send({ isMain: true, altText: "Test second, edited" })
      .expect(200);
    expect(patched.body).toMatchObject({ isMain: true, altText: "Test second, edited" });
    await http
      .patch(`/api/v1/admin/products/${pricedId}/images/${second.id}`)
      .set(auth)
      .send({ altText: "" })
      .expect(400);
    const mains = await db.query(
      "SELECT count(*)::int n FROM product_images WHERE product_id = $1 AND is_main",
      [pricedId],
    );
    expect(mains.rows[0].n).toBe(1);

    // Removing the main image promotes the next one.
    await http.delete(`/api/v1/admin/products/${pricedId}/images/${second.id}`).set(auth).expect(204);
    const admin = (await http.get(`/api/v1/admin/products/${pricedId}`).set(auth).expect(200)).body;
    expect(admin.images.filter((i: { isMain: boolean }) => i.isMain)).toHaveLength(1);
    expect(admin.images[0]).toMatchObject({ id: first.id, isMain: true });

    // Draft → all its images are private.
    pub = (await http.get("/api/v1/products/test-priced-item").expect(200)).body;
    await http.get(pub.images[0].url).expect(200);
    await publish(pricedId, false);
    for (const i of pub.images) await http.get(i.url).expect(404);
    await publish(pricedId, true);
  });

  it("the database rejects invalid pricing directly (backstop constraints)", async () => {
    const bad = [
      "UPDATE products SET price_lkr = -1 WHERE id = $1",
      "UPDATE products SET discount_type = 'percentage', discount_value = 101 WHERE id = $1",
      "UPDATE products SET discount_type = 'fixed', discount_value = price_lkr + 1 WHERE id = $1",
      "UPDATE products SET contact_for_price = false, price_lkr = NULL, discount_type = 'none', discount_value = NULL, discount_enabled = false WHERE id = $1",
      "UPDATE products SET discount_starts_on = '2026-12-02', discount_ends_on = '2026-12-01' WHERE id = $1",
      "UPDATE products SET availability = 'maybe' WHERE id = $1",
    ];
    for (const sql of bad) await expect(db.query(sql, [pricedId])).rejects.toMatchObject({ code: "23514" });
    const col = await db.query(
      "SELECT data_type FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'price_lkr'",
    );
    expect(col.rows[0].data_type).toBe("numeric");
  });
});

describe("Migration 0002 on a database with existing (0001) data", () => {
  it("is additive: keeps products, publication and images; sets honest defaults and one main image", async () => {
    const base = process.env.DATABASE_URL!;
    const name = `t_${randomBytes(6).toString("hex")}`;
    const admin = new Client({ connectionString: base });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${name} TEMPLATE template0 ENCODING 'UTF8'`);
    await admin.end();
    const url = new URL(base);
    url.pathname = `/${name}`;
    const db = new Client({ connectionString: url.toString() });
    await db.connect();
    const only1 = await mkdtemp(path.join(process.env.TEMP ?? tmpdir(), "mig-0001-"));
    try {
      await copyFile(
        path.join(MIGRATIONS_DIR, "0001_initial_schema.sql"),
        path.join(only1, "0001_initial_schema.sql"),
      );
      await applyMigrations(db, only1);
      const cat = (await db.query("INSERT INTO categories (slug, name) VALUES ('c', 'C') RETURNING id"))
        .rows[0].id;
      const pid = (
        await db.query(
          `INSERT INTO products (slug, name, category_id, is_published, published_at)
           VALUES ('p', 'P', $1, true, now()) RETURNING id`,
          [cat],
        )
      ).rows[0].id;
      for (const [i, key] of [
        "11111111-1111-1111-1111-111111111111",
        "22222222-2222-2222-2222-222222222222",
      ].entries()) {
        await db.query(
          `INSERT INTO product_images (product_id, storage_key, mime_type, width, height, size_bytes, alt_text, sort_order)
           VALUES ($1, $2, 'image/webp', 10, 10, 10, 'x', $3)`,
          [pid, key, i],
        );
      }

      expect(await applyMigrations(db)).toEqual([
        "0002_product_pricing.sql",
        "0003_brand_logos_category_images.sql",
        "0004_quotation_requests.sql",
        "0005_quotation_notifications.sql",
        "0006_content_translations.sql",
        "0007_customer_feedback.sql",
        "0008_admin_services_gallery_staff.sql",
        "0009_offers.sql",
        "0010_staff_profile_photos.sql",
      ]);
      const p = (await db.query("SELECT * FROM products WHERE id = $1", [pid])).rows[0];
      expect(p).toMatchObject({
        is_published: true,
        unit: null,
        price_lkr: null,
        contact_for_price: true,
        discount_type: "none",
        discount_enabled: false,
        availability: "on_request",
      });
      const imgs = (await db.query("SELECT storage_key, is_main FROM product_images ORDER BY sort_order"))
        .rows;
      expect(imgs.map((r) => r.is_main)).toEqual([true, false]);
    } finally {
      await db.end();
      await rm(only1, { recursive: true, force: true });
    }
  });
});
