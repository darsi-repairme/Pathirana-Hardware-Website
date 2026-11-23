import type { INestApplication } from "@nestjs/common";
import type { Client } from "pg";
import sharp from "sharp";
import request from "supertest";
import { createStaff, createTestApp, login } from "./helpers";

/**
 * Services and Gallery managed in the Admin (migration 0008). Isolated throwaway database
 * and local media storage — every record here is TEST data (the six seeded services are the
 * already-approved website services).
 */
const EDITOR = { email: "content-editor@test.invalid", password: "Content-Editor-Password-1" };

describe("Website content: services and gallery", () => {
  let app: INestApplication;
  let db: Client;
  let http: ReturnType<typeof request>;
  let auth: { Authorization: string };
  let jpeg: Buffer;

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    http = request(app.getHttpServer());
    await createStaff(db, EDITOR.email, "editor", EDITOR.password);
    auth = { Authorization: `Bearer ${await login(app, EDITOR.email, EDITOR.password)}` };
    jpeg = await sharp({ create: { width: 1800, height: 1200, channels: 3, background: "#0f5d3a" } })
      .jpeg()
      .toBuffer();
  });
  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it("services: the six approved services are seeded, published and ordered", async () => {
    const pub = await http.get("/api/v1/services").expect(200);
    expect(pub.body.items.map((s: { slug: string }) => s.slug)).toEqual([
      "building-material-supply",
      "home-site-delivery",
      "bulk-orders",
      "product-reservations",
      "product-advice",
      "contractor-support",
    ]);
    expect(pub.body.items[0]).toMatchObject({
      title: "Building Material Supply",
      icon: "bricks",
      image: null,
    });
  });

  it("services: staff edit, validate, add (hidden), publish and hide; public list follows", async () => {
    await http.get("/api/v1/admin/services").expect(401);
    const list = (await http.get("/api/v1/admin/services").set(auth).expect(200)).body as {
      id: string;
      slug: string;
    }[];
    const bulk = list.find((s) => s.slug === "bulk-orders")!;
    // Validation: negative / decimal order, empty title, unknown icon, unknown field.
    for (const body of [
      { sortOrder: -1 },
      { sortOrder: 2.5 },
      { title: "   " },
      { icon: "rocket" },
      { price: 1 },
    ])
      await http.patch(`/api/v1/admin/services/${bulk.id}`).set(auth).send(body).expect(400);
    await http
      .patch(`/api/v1/admin/services/${bulk.id}`)
      .set(auth)
      .send({
        summary: "  Enquire about  larger-quantity orders. ",
        sortOrder: 5,
        translations: { ta: { title: "மொத்த ஆர்டர்கள்" } },
      })
      .expect(200);
    const created = await http
      .post("/api/v1/admin/services")
      .set(auth)
      .send({
        title: "Test Service",
        summary: "Test summary.",
        description: "Test description.",
        icon: "truck",
        kind: "delivery",
      })
      .expect(201);
    expect(created.body).toMatchObject({ slug: "test-service", isPublished: false, sortOrder: 0 });
    await http
      .post("/api/v1/admin/services")
      .set(auth)
      .send({ title: "Test Service", summary: "S", description: "D", icon: "truck", kind: "delivery" })
      .expect(409);
    let pub = (await http.get("/api/v1/services").expect(200)).body.items as {
      slug: string;
      summary: string;
      translations: object;
    }[];
    expect(pub.map((s) => s.slug)).not.toContain("test-service"); // hidden until published
    expect(pub.find((s) => s.slug === "bulk-orders")).toMatchObject({
      summary: "Enquire about larger-quantity orders.",
      translations: { ta: { title: "மொத்த ஆர்டர்கள்" } },
    });
    await http
      .patch(`/api/v1/admin/services/${created.body.id}/publication`)
      .set(auth)
      .send({ isPublished: true })
      .expect(200);
    pub = (await http.get("/api/v1/services").expect(200)).body.items;
    expect(pub.map((s) => s.slug)).toContain("test-service");
    await http
      .patch(`/api/v1/admin/services/${created.body.id}/publication`)
      .set(auth)
      .send({ isPublished: false })
      .expect(200);
    const actions = (
      await db.query("SELECT action FROM audit_log WHERE entity_type = 'service' ORDER BY id")
    ).rows.map((r) => r.action);
    expect(actions).toEqual(["service.update", "service.create", "service.publish", "service.hide"]);
  });

  it("services: image upload (validated), public only while published, replace and remove", async () => {
    const svc = (await http.get("/api/v1/admin/services").set(auth)).body.find(
      (s: { slug: string }) => s.slug === "product-advice",
    );
    await http
      .post(`/api/v1/admin/services/${svc.id}/image`)
      .set(auth)
      .attach("file", Buffer.from("not an image"), { filename: "x.jpg", contentType: "image/jpeg" })
      .field("altText", "Alt")
      .expect(415);
    await http
      .post(`/api/v1/admin/services/${svc.id}/image`)
      .set(auth)
      .attach("file", jpeg, "a.jpg")
      .expect(400); // alt text required
    const up = await http
      .post(`/api/v1/admin/services/${svc.id}/image`)
      .set(auth)
      .attach("file", jpeg, "a.jpg")
      .field("altText", "Staff advising a customer")
      .expect(201);
    const key = up.body.imageKey as string;
    const pubItem = (await http.get("/api/v1/services")).body.items.find(
      (s: { slug: string }) => s.slug === "product-advice",
    );
    expect(pubItem.image).toMatchObject({ url: `/api/v1/service-images/${key}`, width: 1600, height: 1067 });
    const thumb = await http.get(`/api/v1/service-images/${key}?size=thumb`).buffer(true).expect(200);
    expect((await sharp(thumb.body).metadata()).width).toBe(480);
    await http.get(`/api/v1/admin/services/${svc.id}/image`).set(auth).expect(200);
    await http
      .patch(`/api/v1/admin/services/${svc.id}/publication`)
      .set(auth)
      .send({ isPublished: false })
      .expect(200);
    await http.get(`/api/v1/service-images/${key}`).expect(404); // hidden service → image not public
    await http
      .patch(`/api/v1/admin/services/${svc.id}/publication`)
      .set(auth)
      .send({ isPublished: true })
      .expect(200);
    await http.delete(`/api/v1/admin/services/${svc.id}/image`).set(auth).expect(204);
    await http.get(`/api/v1/service-images/${key}`).expect(404);
  });

  it("gallery: upload (hidden first), publish, edit, replace, delete; unpublished photos are never public", async () => {
    await http.get("/api/v1/admin/gallery").expect(401);
    await http
      .post("/api/v1/admin/gallery")
      .set(auth)
      .attach("file", jpeg, "g.jpg")
      .field("title", "Shop front")
      .expect(400); // alt missing
    await http
      .post("/api/v1/admin/gallery")
      .set(auth)
      .attach("file", jpeg, "g.jpg")
      .field("title", "Shop front")
      .field("altText", "The shop front")
      .field("sortOrder", "-2")
      .expect(400);
    await http
      .post("/api/v1/admin/gallery")
      .set(auth)
      .attach("file", Buffer.from("<svg/>"), { filename: "x.svg", contentType: "image/svg+xml" })
      .field("title", "X")
      .field("altText", "X")
      .expect(415);
    const up = await http
      .post("/api/v1/admin/gallery")
      .set(auth)
      .attach("file", jpeg, "g.jpg")
      .field("title", "Test photo")
      .field("altText", "A test photo")
      .field("caption", "Test caption")
      .field("sortOrder", "3")
      .expect(201);
    expect(up.body).toMatchObject({
      title: "Test photo",
      isPublished: false,
      sortOrder: 3,
      width: 1800,
      height: 1200,
    });
    const id = up.body.id as string;
    expect((await http.get("/api/v1/gallery")).body.items).toEqual([]);
    await http.get(`/api/v1/gallery-images/${id}`).expect(404);
    await http.get(`/api/v1/admin/gallery/${id}/image?size=thumb`).set(auth).expect(200);

    await http
      .patch(`/api/v1/admin/gallery/${id}/publication`)
      .set(auth)
      .send({ isPublished: true })
      .expect(200);
    const pub = (await http.get("/api/v1/gallery")).body.items;
    expect(pub).toEqual([
      expect.objectContaining({
        id,
        title: "Test photo",
        caption: "Test caption",
        url: `/api/v1/gallery-images/${id}`,
      }),
    ]);
    const thumb = await http.get(`/api/v1/gallery-images/${id}?size=thumb`).buffer(true).expect(200);
    expect((await sharp(thumb.body).metadata()).width).toBe(640);

    await http
      .patch(`/api/v1/admin/gallery/${id}`)
      .set(auth)
      .send({ title: "Renamed", sortOrder: 1.5 })
      .expect(400);
    await http
      .patch(`/api/v1/admin/gallery/${id}`)
      .set(auth)
      .send({ title: "Renamed", caption: "" })
      .expect(200);
    const small = await sharp({ create: { width: 900, height: 600, channels: 3, background: "#b8860b" } })
      .png()
      .toBuffer();
    const rep = await http
      .post(`/api/v1/admin/gallery/${id}/image`)
      .set(auth)
      .attach("file", small, "b.png")
      .expect(201);
    expect(rep.body).toMatchObject({ title: "Renamed", caption: null, width: 900, isPublished: true });

    await http.delete(`/api/v1/admin/gallery/${id}`).set(auth).expect(204);
    await http.get(`/api/v1/gallery-images/${id}`).expect(404);
    await http.delete(`/api/v1/admin/gallery/${id}`).set(auth).expect(404);
    const actions = (
      await db.query("SELECT action FROM audit_log WHERE entity_type = 'gallery' ORDER BY id")
    ).rows.map((r) => r.action);
    expect(actions).toEqual([
      "gallery.add",
      "gallery.publish",
      "gallery.update",
      "gallery.replace",
      "gallery.delete",
    ]);
  });

  it("categories: display order must be a whole number 0 or more (API and database)", async () => {
    for (const sortOrder of [-1, 1.5, "3", 1e9])
      await http
        .post("/api/v1/admin/categories")
        .set(auth)
        .send({ name: `Cat ${String(sortOrder)}`, sortOrder })
        .expect(400);
    const ok = await http
      .post("/api/v1/admin/categories")
      .set(auth)
      .send({ name: "Order Zero", sortOrder: 0 })
      .expect(201);
    expect(ok.body.sortOrder).toBe(0);
    await expect(
      db.query("UPDATE categories SET sort_order = -5 WHERE id = $1", [ok.body.id]),
    ).rejects.toThrow(/categories_sort_order_nonnegative/);
  });

  it("quotation emails are retired: no notification jobs are created", async () => {
    await http.post("/api/v1/admin/delivery-areas").set(auth).send({ name: "Content Test Area" }).expect(201);
    await http
      .post("/api/v1/quotations")
      .field(
        "data",
        JSON.stringify({
          idempotencyKey: "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
          customerName: "Test Customer",
          phone: "0712345678",
          location: "Content Test Area",
          fulfilment: "collection",
          contactConsent: true,
          items: [{ productName: "Test Cement", quantity: "1" }],
        }),
      )
      .expect(201);
    expect((await db.query("SELECT count(*)::int AS n FROM quotation_notifications")).rows[0].n).toBe(0);
    await http.get("/api/v1/admin/settings/quotation-notifications").set(auth).expect(404);
  });
});
