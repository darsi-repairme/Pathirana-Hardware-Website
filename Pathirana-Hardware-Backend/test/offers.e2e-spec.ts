import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import type { Client } from "pg";
import request from "supertest";
import { createStaff, createTestApp, login } from "./helpers";

/**
 * Offers & promo codes (migration 0009). Isolated throwaway database — every offer, code,
 * product and request here is TEST data.
 */
const ADMIN = { email: "offers-admin@test.invalid", password: "Offers-Admin-Password-1" };
const EDITOR = { email: "offers-editor@test.invalid", password: "Offers-Editor-Password-2" };

describe("Offers & promo codes", () => {
  let app: INestApplication;
  let db: Client;
  let http: ReturnType<typeof request>;
  let admin: { Authorization: string };
  let editor: { Authorization: string };
  let ip = 0;
  const from = () => `10.60.${Math.floor(++ip / 200)}.${ip % 200}`;
  let productId: string;
  let categoryId: string;
  let otherSlug: string;
  const day = (offset: number) => {
    const d = new Date(Date.now() + 330 * 60_000 + offset * 86_400_000);
    return d.toISOString().slice(0, 10);
  };

  beforeAll(async () => {
    ({ app, db } = await createTestApp({ TRUST_PROXY: "true" }));
    http = request(app.getHttpServer());
    await createStaff(db, ADMIN.email, "admin", ADMIN.password);
    await createStaff(db, EDITOR.email, "editor", EDITOR.password);
    admin = { Authorization: `Bearer ${await login(app, ADMIN.email, ADMIN.password)}` };
    editor = { Authorization: `Bearer ${await login(app, EDITOR.email, EDITOR.password)}` };
    const cat = await db.query<{ id: string }>(
      "INSERT INTO categories (name, slug) VALUES ('Test Offer Category', 'test-offer-category') RETURNING id",
    );
    categoryId = cat.rows[0]!.id;
    const other = await db.query<{ id: string }>(
      "INSERT INTO categories (name, slug) VALUES ('Test Other Category', 'test-other-category') RETURNING id",
    );
    const p = await db.query<{ id: string }>(
      `INSERT INTO products (name, slug, category_id, is_published, published_at)
       VALUES ('Test Offer Cement', 'test-offer-cement', $1, true, now()) RETURNING id`,
      [categoryId],
    );
    productId = p.rows[0]!.id;
    await db.query(
      `INSERT INTO products (name, slug, category_id, is_published, published_at)
       VALUES ('Test Other Item', 'test-other-item', $1, true, now())`,
      [other.rows[0]!.id],
    );
    otherSlug = "test-other-item";
    await http.post("/api/v1/admin/delivery-areas").set(admin).send({ name: "Test Offer Area" }).expect(201);
  });
  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it("refuses anonymous access; validates discount, dates and codes", async () => {
    await http.get("/api/v1/admin/offers").expect(401);
    await http.post("/api/v1/admin/offers").send({ title: "X" }).expect(401);
    for (const body of [
      { title: "Test", discountType: "percentage", discountValue: 150 },
      { title: "Test", discountType: "percentage", discountValue: 0 },
      { title: "Test", discountType: "fixed", discountValue: -5 },
      { title: "Test", discountType: "percentage" },
      { title: "Test", startsOn: "2026-12-10", endsOn: "2026-12-01" },
      { title: "Test", startsOn: "2026-02-30" },
      { title: "Test", promoCode: "has space" },
      { title: "Test", promoCode: "AB" },
      { title: "   " },
      { title: "Test", sortOrder: -1 },
      { title: "Test", appliesTo: "selected" },
      { title: "Test", price: 1 },
    ])
      await http.post("/api/v1/admin/offers").set(editor).send(body).expect(400);
  });

  it("editor prepares drafts, admin publishes; hidden and future offers stay private", async () => {
    const draft = await http
      .post("/api/v1/admin/offers")
      .set(editor)
      .send({
        title: "Test Cement Offer",
        benefit: "10% off",
        description: "Test description.",
        discountType: "percentage",
        discountValue: 10,
        promoCode: "test-cement10",
        appliesTo: "selected",
        productIds: [productId],
        endsOn: day(5),
        translations: { ta: { title: "சோதனை சலுகை" } },
      })
      .expect(201);
    expect(draft.body).toMatchObject({
      promoCode: "TEST-CEMENT10",
      isPublished: false,
      status: "hidden",
      products: [{ id: productId, slug: "test-offer-cement" }],
    });
    // Duplicate code (any case) → 409.
    await http
      .post("/api/v1/admin/offers")
      .set(editor)
      .send({ title: "Dup", promoCode: "Test-Cement10" })
      .expect(409);
    // Not public while hidden; the code is "unknown" (never revealed).
    expect((await http.get("/api/v1/offers").expect(200)).body.items).toEqual([]);
    const hiddenCheck = await http
      .post("/api/v1/offers/validate")
      .set("X-Forwarded-For", from())
      .send({ code: "test-cement10", productSlugs: ["test-offer-cement"] })
      .expect(200);
    expect(hiddenCheck.body).toEqual({ code: "TEST-CEMENT10", status: "unknown", offer: null });

    // Editors cannot publish (403 from the API, not only the UI).
    await http
      .patch(`/api/v1/admin/offers/${draft.body.id}/publication`)
      .set(editor)
      .send({ isPublished: true })
      .expect(403);
    await http
      .patch(`/api/v1/admin/offers/${draft.body.id}/publication`)
      .set(admin)
      .send({ isPublished: true })
      .expect(200);
    const pub = (await http.get("/api/v1/offers").expect(200)).body.items;
    expect(pub).toHaveLength(1);
    expect(pub[0]).toMatchObject({
      title: "Test Cement Offer",
      promoCode: "TEST-CEMENT10",
      discountType: "percentage",
      discountValue: 10,
      endsOn: day(5),
      products: [{ name: "Test Offer Cement", slug: "test-offer-cement" }],
      translations: { ta: { title: "சோதனை சலுகை" } },
    });
    expect(pub[0]).not.toHaveProperty("isPublished");
    expect(pub[0]).not.toHaveProperty("createdBy");

    // Once published, an editor can fix wording but not the code / discount / dates.
    await http
      .patch(`/api/v1/admin/offers/${draft.body.id}`)
      .set(editor)
      .send({ description: "Test description edited." })
      .expect(200);
    await http
      .patch(`/api/v1/admin/offers/${draft.body.id}`)
      .set(editor)
      .send({ discountValue: 50 })
      .expect(403);
    await http
      .patch(`/api/v1/admin/offers/${draft.body.id}`)
      .set(admin)
      .send({ discountValue: 12 })
      .expect(200);

    // A future offer is not public yet.
    const future = await http
      .post("/api/v1/admin/offers")
      .set(admin)
      .send({ title: "Test Future Offer", promoCode: "TEST-FUTURE", startsOn: day(3) })
      .expect(201);
    await http
      .patch(`/api/v1/admin/offers/${future.body.id}/publication`)
      .set(admin)
      .send({ isPublished: true })
      .expect(200);
    expect((await http.get("/api/v1/admin/offers").set(admin).expect(200)).body).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: "Test Future Offer", status: "scheduled" })]),
    );
    expect(
      (await http.get("/api/v1/offers").expect(200)).body.items.map((o: { title: string }) => o.title),
    ).toEqual(["Test Cement Offer"]);

    // An ended offer is reported as expired, then never listed.
    const ended = await http
      .post("/api/v1/admin/offers")
      .set(admin)
      .send({ title: "Test Ended Offer", promoCode: "TEST-ENDED" })
      .expect(201);
    await db.query("UPDATE offers SET is_published = true, ends_on = $2 WHERE id = $1", [
      ended.body.id,
      day(-1),
    ]);
    const endedCheck = await http
      .post("/api/v1/offers/validate")
      .set("X-Forwarded-For", from())
      .send({ code: "test-ended" })
      .expect(200);
    expect(endedCheck.body.status).toBe("expired");
    const audit = await db.query("SELECT action FROM audit_log WHERE entity_type = 'offer' ORDER BY id");
    expect(audit.rows.map((r) => r.action)).toEqual(
      expect.arrayContaining(["offer.create", "offer.publish", "offer.update"]),
    );
  });

  it("code check and quotation: eligibility is recorded; prices are never changed", async () => {
    const check = (code: string, productSlugs: string[]) =>
      http
        .post("/api/v1/offers/validate")
        .set("X-Forwarded-For", from())
        .send({ code, productSlugs })
        .expect(200);
    expect((await check("TEST-CEMENT10", ["test-offer-cement"])).body.status).toBe("valid");
    expect((await check("TEST-CEMENT10", [otherSlug])).body.status).toBe("not_eligible");
    expect((await check("NO-SUCH-CODE", [])).body.status).toBe("unknown");

    const submit = (promoCode: string, slug: string) =>
      http
        .post("/api/v1/quotations")
        .set("X-Forwarded-For", from())
        .field(
          "data",
          JSON.stringify({
            idempotencyKey: randomUUID(),
            customerName: "Test Offer Customer",
            phone: "0712345678",
            location: "Test Offer Area",
            fulfilment: "collection",
            contactConsent: true,
            promoCode,
            items: [
              { productName: "Test item", productSlug: slug, quantity: String(1 + (ip % 7)), unit: "bag" },
            ],
          }),
        )
        .expect(201);
    const ok = await submit(" test-cement10 ", "test-offer-cement");
    expect(ok.body.promoStatus).toBe("valid");
    const bad = await submit("NOPE-123", otherSlug);
    expect(bad.body.promoStatus).toBe("unknown");
    const rows = await db.query(
      `SELECT r.reference, r.promo_code, r.promo_status, o.title FROM quotation_requests r
         LEFT JOIN offers o ON o.id = r.promo_offer_id WHERE r.reference = ANY($1) ORDER BY r.promo_code`,
      [[ok.body.reference, bad.body.reference]],
    );
    expect(rows.rows).toEqual([
      { reference: bad.body.reference, promo_code: "NOPE-123", promo_status: "unknown", title: null },
      {
        reference: ok.body.reference,
        promo_code: "TEST-CEMENT10",
        promo_status: "valid",
        title: "Test Cement Offer",
      },
    ]);
    // Staff see the code and its result on the request.
    const list = await http.get(`/api/v1/admin/quotations?q=${ok.body.reference}`).set(editor).expect(200);
    const detail = await http
      .get(`/api/v1/admin/quotations/${list.body.items[0].id}`)
      .set(editor)
      .expect(200);
    expect(detail.body).toMatchObject({
      promoCode: "TEST-CEMENT10",
      promoStatus: "valid",
      promoOfferTitle: "Test Cement Offer",
    });
    // Product prices untouched by offers.
    const price = await db.query("SELECT price_lkr, discount_type FROM products WHERE id = $1", [productId]);
    expect(price.rows[0]).toEqual({ price_lkr: null, discount_type: "none" });
    // A malformed code is rejected by validation (400), nothing saved.
    await http
      .post("/api/v1/quotations")
      .set("X-Forwarded-For", from())
      .field(
        "data",
        JSON.stringify({
          idempotencyKey: randomUUID(),
          customerName: "Test",
          phone: "0712345678",
          location: "Test Offer Area",
          fulfilment: "collection",
          contactConsent: true,
          promoCode: "<script>",
          items: [{ productName: "Test", quantity: "1" }],
        }),
      )
      .expect(400);
  });
});
