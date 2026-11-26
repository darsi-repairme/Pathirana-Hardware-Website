import { randomUUID } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import type { INestApplication } from "@nestjs/common";
import type { Client } from "pg";
import sharp from "sharp";
import request from "supertest";
import { createStaff, createTestApp, login } from "./helpers";

/**
 * Batch 5B — quotation requests (and Batch 5C permanent product deletion).
 * Isolated throwaway database; every name, number and item here is TEST data.
 */
const ADMIN = { email: "quote-admin@test.invalid", password: "Quote-Admin-Password-1" };
const EDITOR = { email: "quote-editor@test.invalid", password: "Quote-Editor-Password-2" };
const UPLOADS = () => path.join(process.env.TEST_UPLOAD_DIR!, "quotations");

let ip = 0;
const nextIp = () => `10.77.${Math.floor(++ip / 200)}.${ip % 200}`;

describe("Quotation requests", () => {
  let app: INestApplication;
  let db: Client;
  let http: ReturnType<typeof request>;
  let admin: { Authorization: string };
  let editor: { Authorization: string };
  let photo: Buffer;

  beforeAll(async () => {
    ({ app, db } = await createTestApp({ TRUST_PROXY: "true" }));
    http = request(app.getHttpServer());
    await createStaff(db, ADMIN.email, "admin", ADMIN.password);
    await createStaff(db, EDITOR.email, "editor", EDITOR.password);
    admin = { Authorization: `Bearer ${await login(app, ADMIN.email, ADMIN.password)}` };
    editor = { Authorization: `Bearer ${await login(app, EDITOR.email, EDITOR.password)}` };
    for (const name of ["Test Area One", "Test Area Two"]) {
      await http.post("/api/v1/admin/delivery-areas").set(admin).send({ name }).expect(201);
    }
    photo = await sharp({ create: { width: 2400, height: 1800, channels: 3, background: "#b8860b" } })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Artist: "Test Camera Owner" } } })
      .toBuffer();
  });
  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  const base = () => ({
    idempotencyKey: randomUUID(),
    customerName: "Test Customer",
    phone: "0712345678",
    location: "Test Area One",
    fulfilment: "delivery",
    deliveryAddress: "Test address line",
    contactConsent: true,
    items: [{ productName: "Test Cement", quantity: "10", unit: "bag" }],
  });
  const submit = (data: unknown, photos: Buffer[] = [], from = nextIp()) => {
    let r = http.post("/api/v1/quotations").set("X-Forwarded-For", from).field("data", JSON.stringify(data));
    photos.forEach(
      (p, i) => (r = r.attach("photos", p, { filename: `p${i}.jpg`, contentType: "image/jpeg" })),
    );
    return r;
  };

  let firstId = "";
  let firstRef = "";

  it("saves a request with several items and private, optimised photos", async () => {
    const data = {
      ...base(),
      email: "Test.Customer@Example.TEST",
      notes: "Test notes\n\nsecond line",
      items: [
        { productName: "Test Cement", quantity: "10", unit: "bag" },
        { productName: "Test TOR Bars", quantity: "2.5", unit: "ton" },
        { productName: "Test Plywood", quantity: "4" },
      ],
    };
    const res = await submit(data, [photo, photo]).expect(201);
    expect(res.body).toEqual({
      reference: expect.stringMatching(/^PHQ-\d{6}-[A-Z2-9]{5}$/),
      photoCount: 2,
      duplicate: false,
    });
    firstRef = res.body.reference;

    const row = (await db.query("SELECT * FROM quotation_requests WHERE reference = $1", [firstRef])).rows[0];
    firstId = row.id;
    expect(row).toMatchObject({
      customer_name: "Test Customer",
      phone: "+94712345678", // normalised
      email: "test.customer@example.test",
      location: "Test Area One",
      location_listed: true,
      fulfilment: "delivery",
      delivery_address: "Test address line",
      notes: "Test notes\n\nsecond line",
      status: "new",
    });
    const items = (
      await db.query(
        "SELECT position, product_name, quantity::text, unit FROM quotation_items WHERE quotation_id = $1 ORDER BY position",
        [firstId],
      )
    ).rows;
    expect(items).toEqual([
      { position: 1, product_name: "Test Cement", quantity: "10.000", unit: "bag" },
      { position: 2, product_name: "Test TOR Bars", quantity: "2.500", unit: "ton" },
      { position: 3, product_name: "Test Plywood", quantity: "4.000", unit: null },
    ]);
    // Stored privately (outside any web root), resized, re-encoded, metadata removed.
    const files = readdirSync(UPLOADS());
    expect(files.filter((f) => f.endsWith("-thumb.webp"))).toHaveLength(2);
    const full = files.find((f) => !f.includes("thumb"))!;
    const meta = await sharp(path.join(UPLOADS(), full)).metadata();
    expect(meta).toMatchObject({ format: "webp", width: 1600, height: 1200 });
    expect(meta.exif).toBeUndefined();
  });

  it("returns the existing request for a retried or identical submission (no duplicates)", async () => {
    const data = { ...base(), items: [{ productName: "Test Dedupe Item", quantity: "1" }] };
    const a = await submit(data).expect(201);
    const retry = await submit(data).expect(201); // same idempotency key
    expect(retry.body).toEqual({ reference: a.body.reference, photoCount: 0, duplicate: true });
    const again = await submit({ ...data, idempotencyKey: randomUUID() }).expect(201); // same content, new form
    expect(again.body.reference).toBe(a.body.reference);
    expect(again.body.duplicate).toBe(true);
    await submit({ ...data, items: [{ productName: "Changed", quantity: "1" }] }).expect(409); // same key, other content
    const n = (
      await db.query("SELECT count(*)::int AS n FROM quotation_requests WHERE reference = $1", [
        a.body.reference,
      ])
    ).rows[0].n;
    expect(n).toBe(1);
  });

  it("collection needs no address; 'Other' needs the customer's own location", async () => {
    const res = await submit({
      ...base(),
      fulfilment: "collection",
      deliveryAddress: "ignored for collection",
      location: "Other",
      otherLocation: "Test Village",
      items: [{ productName: "Test Collect Item", quantity: "3", unit: "piece" }],
    }).expect(201);
    const row = (
      await db.query(
        "SELECT location, location_listed, delivery_address FROM quotation_requests WHERE reference = $1",
        [res.body.reference],
      )
    ).rows[0];
    expect(row).toEqual({ location: "Test Village", location_listed: false, delivery_address: null });
  });

  it("validates every field on the server", async () => {
    const bad = async (patch: object, expected: RegExp) => {
      const res = await submit({ ...base(), ...patch }).expect(400);
      expect(JSON.stringify(res.body)).toMatch(expected);
    };
    await bad({ customerName: "" }, /customerName/);
    await bad({ phone: "12" }, /10-digit mobile number/);
    await bad({ phone: "not-a-number-here" }, /10-digit mobile number/);
    // Exactly 10 digits starting with 0 — formatted, international, short or long numbers are refused.
    for (const phone of [
      "071 234 5678",
      "+94712345678",
      "7123456789",
      "07123456789",
      "071234567",
      "071-234-5678",
    ])
      await bad({ phone }, /Please enter a valid 10-digit mobile number/);
    // Consent is mandatory: false or missing → refused (nothing saved, never a false success).
    const { contactConsent: _omit, ...noConsent } = base();
    void _omit;
    const res = await submit(noConsent).expect(400);
    expect(JSON.stringify(res.body)).toMatch(/consent/);
    await bad({ fulfilment: "delivery", deliveryAddress: "   " }, /deliveryAddress/);
    await bad({ location: "Nowhere Listed" }, /location/);
    await bad({ location: "Other", otherLocation: "" }, /otherLocation/);
    await bad({ contactConsent: false }, /consent/);
    await bad({ items: [] }, /items/);
    await bad({ items: [{ productName: "X", quantity: "0" }] }, /quantity/);
    await bad({ items: [{ productName: "X", quantity: "-2" }] }, /quantity/);
    await bad({ email: "not-an-email" }, /email/);
    await bad({ unexpected: "field" }, /should not exist/);
    await http
      .post("/api/v1/quotations")
      .set("X-Forwarded-For", nextIp())
      .field("data", "{not json")
      .expect(400);
    // Photos: content is checked (a renamed text file is refused), and at most 5.
    await submit(base(), [Buffer.from("#!/bin/sh\necho no")]).expect(415);
    await submit(base(), [photo, photo, photo, photo, photo, photo]).expect(400);
    // Oversized photo (tests: MAX_UPLOAD_MB=1) → 413.
    const huge = await sharp({ create: { width: 3000, height: 3000, channels: 3, background: "#808080" } })
      .png({ compressionLevel: 0 })
      .toBuffer();
    expect(huge.length).toBeGreaterThan(1024 * 1024);
    await http
      .post("/api/v1/quotations")
      .set("X-Forwarded-For", nextIp())
      .field("data", JSON.stringify(base()))
      .attach("photos", huge, { filename: "big.png", contentType: "image/png" })
      .expect(413);
    // Anti-spam honeypot filled (people never see it) → refused, never a false success.
    const spam = await submit({ ...base(), website: "http://spam.example.test" }, [photo]).expect(400);
    expect(JSON.stringify(spam.body)).toMatch(/could not be accepted/);
    // Nothing from the refused submissions was stored, and no photo was written.
    const n = (await db.query("SELECT count(*)::int AS n FROM quotation_requests")).rows[0].n;
    expect(n).toBe(3);
    const photos = (await db.query("SELECT count(*)::int AS n FROM quotation_photos")).rows[0].n;
    expect(photos).toBe(2); // only the 2 from the first (valid) request
  });

  it("is rate limited per client", async () => {
    const from = "10.99.0.1";
    for (let i = 0; i < 6; i++)
      await submit({ ...base(), customerName: `Test Rate ${i}` }, [], from).expect(201);
    await submit({ ...base(), customerName: "Test Rate 7" }, [], from).expect(429);
  });

  it("staff: list, search, filter, detail, photos and status — never public", async () => {
    // No public way to read requests or photos.
    await http.get("/api/v1/quotations").expect(404);
    await http.get(`/api/v1/admin/quotations`).expect(401);
    await http.get(`/api/v1/admin/quotations/${firstId}`).expect(401);

    const list = await http.get("/api/v1/admin/quotations").set(editor).expect(200);
    expect(list.body.total).toBeGreaterThanOrEqual(3);
    expect(list.body.statusCounts.new).toBe(list.body.total);
    const found = await http.get("/api/v1/admin/quotations").query({ q: firstRef }).set(editor).expect(200);
    expect(found.body.items).toEqual([
      expect.objectContaining({
        reference: firstRef,
        customerName: "Test Customer",
        itemCount: 3,
        photoCount: 2,
      }),
    ]);
    const byPhone = await http
      .get("/api/v1/admin/quotations")
      .query({ q: "0712345678" })
      .set(editor)
      .expect(200);
    expect(byPhone.body.total).toBeGreaterThanOrEqual(1);
    const byItem = await http
      .get("/api/v1/admin/quotations")
      .query({ q: "TOR bars" })
      .set(editor)
      .expect(200);
    expect(byItem.body.items.map((i: { reference: string }) => i.reference)).toContain(firstRef);

    const detail = await http.get(`/api/v1/admin/quotations/${firstId}`).set(editor).expect(200);
    expect(detail.body).toMatchObject({ reference: firstRef, phone: "+94712345678", contactConsent: true });
    expect(detail.body.items).toHaveLength(3);
    expect(detail.body.photos).toHaveLength(2);
    const photoUrl = `/api/v1/admin/quotations/${firstId}/photos/${detail.body.photos[0].id}`;
    await http.get(photoUrl).expect(401);
    const img = await http.get(photoUrl).query({ size: "thumb" }).set(editor).buffer(true).expect(200);
    expect(img.headers["cache-control"]).toBe("private, no-store");
    expect((await sharp(img.body as Buffer).metadata()).width).toBe(400);
    await http
      .get(`/api/v1/admin/quotations/${randomUUID()}/photos/${detail.body.photos[0].id}`)
      .set(editor)
      .expect(404);

    await http
      .patch(`/api/v1/admin/quotations/${firstId}/status`)
      .set(editor)
      .send({ status: "paid" })
      .expect(400);
    const updated = await http
      .patch(`/api/v1/admin/quotations/${firstId}/status`)
      .set(editor)
      .send({ status: "in_review" })
      .expect(200);
    expect(updated.body).toMatchObject({ status: "in_review", statusChangedBy: "Test editor" });
    const filtered = await http
      .get("/api/v1/admin/quotations")
      .query({ status: "in_review" })
      .set(admin)
      .expect(200);
    expect(filtered.body.items.map((i: { reference: string }) => i.reference)).toEqual([firstRef]);
    const dash = await http.get("/api/v1/admin/dashboard").set(admin).expect(200);
    expect(dash.body.counts.newQuotations).toBe(list.body.total - 1);
  });

  it("permanent product deletion: admin only, confirmed by slug; images removed; quotation history kept", async () => {
    const cat = await http
      .post("/api/v1/admin/categories")
      .set(admin)
      .send({ name: "Test Delete Category" })
      .expect(201);
    const product = await http
      .post("/api/v1/admin/products")
      .set(admin)
      .send({
        name: "Test Delete Product",
        categoryId: cat.body.id,
        contactForPrice: true,
        discountType: "none",
        discountEnabled: false,
        availability: "on_request",
      })
      .expect(201);
    const id = product.body.id as string;
    const png = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#0f5d3a" } })
      .png()
      .toBuffer();
    const image = await http
      .post(`/api/v1/admin/products/${id}/images`)
      .set(admin)
      .attach("file", png, "x.png")
      .field("altText", "Test delete image")
      .expect(201);
    await http
      .patch(`/api/v1/admin/products/${id}/publication`)
      .set(admin)
      .send({ published: true })
      .expect(200);
    const q = await submit({
      ...base(),
      items: [{ productName: "Test Delete Product", productSlug: "test-delete-product", quantity: "1" }],
    }).expect(201);
    const linked = (
      await db.query(
        "SELECT product_id FROM quotation_items i JOIN quotation_requests r ON r.id = i.quotation_id WHERE r.reference = $1",
        [q.body.reference],
      )
    ).rows[0];
    expect(linked.product_id).toBe(id);
    const imageKey = (await db.query("SELECT storage_key FROM product_images WHERE id = $1", [image.body.id]))
      .rows[0].storage_key;
    const imageFile = path.join(process.env.TEST_UPLOAD_DIR!, "products", `${imageKey}.webp`);
    expect(existsSync(imageFile)).toBe(true);

    await http
      .delete(`/api/v1/admin/products/${id}`)
      .send({ confirmSlug: "test-delete-product" })
      .expect(401);
    await http
      .delete(`/api/v1/admin/products/${id}`)
      .set(editor)
      .send({ confirmSlug: "test-delete-product" })
      .expect(403);
    await http.delete(`/api/v1/admin/products/${id}`).set(admin).send({}).expect(400);
    await http.delete(`/api/v1/admin/products/${id}`).set(admin).send({ confirmSlug: "wrong" }).expect(400);
    const del = await http
      .delete(`/api/v1/admin/products/${id}`)
      .set(admin)
      .send({ confirmSlug: "test-delete-product" })
      .expect(200);
    expect(del.body).toEqual({ deleted: true, imagesRemoved: 1, quotationItemsKept: 1 });
    await http.get(`/api/v1/admin/products/${id}`).set(admin).expect(404);
    await http.get("/api/v1/products/test-delete-product").expect(404);
    expect(existsSync(imageFile)).toBe(false);
    expect(
      (await db.query("SELECT count(*)::int AS n FROM product_images WHERE product_id = $1", [id])).rows[0].n,
    ).toBe(0);
    // The customer's request still shows what they asked for.
    const kept = (
      await db.query(
        "SELECT product_id, product_name FROM quotation_items i JOIN quotation_requests r ON r.id = i.quotation_id WHERE r.reference = $1",
        [q.body.reference],
      )
    ).rows[0];
    expect(kept).toEqual({ product_id: null, product_name: "Test Delete Product" });
    const audit = (await db.query("SELECT details FROM audit_log WHERE action = 'product.delete'")).rows[0];
    expect(audit.details).toMatchObject({ slug: "test-delete-product", images: 1, quotationItemsKept: 1 });
  });
});
