import type { INestApplication } from "@nestjs/common";
import type { Client } from "pg";
import sharp from "sharp";
import request from "supertest";
import { colomboToday } from "../src/catalogue/pricing";
import { createStaff, createTestApp, login } from "./helpers";

/**
 * Admin portal fixes (2026-11-23): staff image URLs with the Admin's cache-buster, audit-log
 * access by role, and future-only dates. Isolated throwaway database — all records are TEST data.
 */
const ADMIN = { email: "portal-admin@test.invalid", password: "Portal-Admin-Password-1" };
const EDITOR = { email: "portal-editor@test.invalid", password: "Portal-Editor-Password-2" };
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

describe("Admin portal: images, audit access, dates", () => {
  let app: INestApplication;
  let db: Client;
  let http: ReturnType<typeof request>;
  let admin: { Authorization: string };
  let editor: { Authorization: string };
  const today = colomboToday();
  const yesterday = addDays(today, -1);
  const nextWeek = addDays(today, 7);

  beforeAll(async () => {
    ({ app, db } = await createTestApp({ TRUST_PROXY: "true" }));
    http = request(app.getHttpServer());
    await createStaff(db, ADMIN.email, "admin", ADMIN.password);
    await createStaff(db, EDITOR.email, "editor", EDITOR.password);
    admin = { Authorization: `Bearer ${await login(app, ADMIN.email, ADMIN.password)}` };
    editor = { Authorization: `Bearer ${await login(app, EDITOR.email, EDITOR.password)}` };
  });
  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it("staff image routes accept the Admin's ?v= cache-buster (was 400) and still reject other parameters", async () => {
    const png = await sharp({ create: { width: 900, height: 600, channels: 3, background: "#0f5d3a" } })
      .png()
      .toBuffer();
    const cat = await http
      .post("/api/v1/admin/categories")
      .set(editor)
      .send({ name: "Test Image Cat" })
      .expect(201);
    const up = await http
      .post(`/api/v1/admin/categories/${cat.body.id}/image`)
      .set(editor)
      .field("altText", "Test photo")
      .attach("file", png, { filename: "c.png", contentType: "image/png" })
      .expect(201);
    const key = up.body.imageKey as string;
    for (const qs of [`?v=${key}`, `?v=${key}&size=thumb`, "?size=thumb", ""]) {
      const r = await http.get(`/api/v1/admin/categories/${cat.body.id}/image${qs}`).set(editor).expect(200);
      expect(r.headers["content-type"]).toMatch(/image\/webp/);
    }
    await http.get(`/api/v1/admin/categories/${cat.body.id}/image?other=1`).set(editor).expect(400);
    await http.get(`/api/v1/admin/categories/${cat.body.id}/image?v=${key}`).expect(401);

    const gallery = await http
      .post("/api/v1/admin/gallery")
      .set(editor)
      .field("title", "Test gallery")
      .field("altText", "Test gallery photo")
      .attach("file", png, { filename: "g.png", contentType: "image/png" })
      .expect(201);
    const v = encodeURIComponent(gallery.body.updatedAt);
    await http
      .get(`/api/v1/admin/gallery/${gallery.body.id}/image?v=${v}&size=thumb`)
      .set(editor)
      .expect(200);
    const svc = (await http.get("/api/v1/admin/services").set(editor).expect(200)).body[0];
    await http
      .post(`/api/v1/admin/services/${svc.id}/image`)
      .set(editor)
      .field("altText", "Test service photo")
      .attach("file", png, { filename: "s.png", contentType: "image/png" })
      .expect(201);
    const svc2 = (await http.get("/api/v1/admin/services").set(editor).expect(200)).body[0];
    await http
      .get(`/api/v1/admin/services/${svc.id}/image?v=${svc2.imageKey}&size=thumb`)
      .set(editor)
      .expect(200);
  });

  it("dashboard: activity only for admins; audit log 401 / 403 / 200", async () => {
    const forAdmin = await http.get("/api/v1/admin/dashboard").set(admin).expect(200);
    expect(Array.isArray(forAdmin.body.activity)).toBe(true);
    expect(forAdmin.body.counts).toEqual(expect.objectContaining({ products: expect.any(Number) }));
    const forEditor = await http.get("/api/v1/admin/dashboard").set(editor).expect(200);
    expect(forEditor.body).not.toHaveProperty("activity");
    expect(forEditor.body.counts).toEqual(forAdmin.body.counts);

    await http.get("/api/v1/admin/audit-log").expect(401);
    await http.get("/api/v1/admin/audit-log").set(editor).expect(403);
    const log = await http.get("/api/v1/admin/audit-log?limit=5").set(admin).expect(200);
    expect(log.body).toMatchObject({ page: 1, limit: 5 });
    expect(log.body.total).toBeGreaterThan(0);
    expect(log.body.items[0]).toEqual(
      expect.objectContaining({ action: expect.any(String), entityType: expect.any(String) }),
    );
    expect(JSON.stringify(log.body)).not.toMatch(/details/);
    const cats = await http.get("/api/v1/admin/audit-log?entityType=category").set(admin).expect(200);
    expect(cats.body.items.every((i: { entityType: string }) => i.entityType === "category")).toBe(true);
    await http.get("/api/v1/admin/audit-log?entityType=nope").set(admin).expect(400);
  });

  it("future-only dates: past rejected, today and later accepted, unchanged stored dates kept", async () => {
    // Offers
    await http
      .post("/api/v1/admin/offers")
      .set(admin)
      .send({ title: "Test past", startsOn: yesterday })
      .expect(400);
    await http
      .post("/api/v1/admin/offers")
      .set(admin)
      .send({ title: "Test past end", endsOn: yesterday })
      .expect(400);
    const ok = await http
      .post("/api/v1/admin/offers")
      .set(admin)
      .send({ title: "Test dates", startsOn: today, endsOn: nextWeek })
      .expect(201);
    await http.patch(`/api/v1/admin/offers/${ok.body.id}`).set(admin).send({ endsOn: yesterday }).expect(400);
    // An older stored date stays valid while other fields are edited.
    await db.query("UPDATE offers SET starts_on = $2 WHERE id = $1", [ok.body.id, yesterday]);
    await http
      .patch(`/api/v1/admin/offers/${ok.body.id}`)
      .set(admin)
      .send({ title: "Test dates edited" })
      .expect(200);

    // Product discount dates
    const cat = await http
      .post("/api/v1/admin/categories")
      .set(admin)
      .send({ name: "Test Date Cat" })
      .expect(201);
    const base = {
      name: "Test Date Product",
      categoryId: cat.body.id,
      contactForPrice: false,
      priceLkr: "1000.00",
      discountType: "percentage",
      discountValue: "10",
      discountEnabled: true,
    };
    await http
      .post("/api/v1/admin/products")
      .set(admin)
      .send({ ...base, discountStartsOn: yesterday })
      .expect(400);
    const p = await http
      .post("/api/v1/admin/products")
      .set(admin)
      .send({ ...base, discountStartsOn: today, discountEndsOn: nextWeek })
      .expect(201);
    await http
      .patch(`/api/v1/admin/products/${p.body.id}`)
      .set(admin)
      .send({ discountEndsOn: yesterday })
      .expect(400);
    await db.query("UPDATE products SET discount_starts_on = $2 WHERE id = $1", [p.body.id, yesterday]);
    await http
      .patch(`/api/v1/admin/products/${p.body.id}`)
      .set(admin)
      .send({ discountValue: "15" })
      .expect(200);
    await http
      .patch(`/api/v1/admin/products/${p.body.id}`)
      .set(admin)
      .send({ discountStartsOn: today, discountEndsOn: addDays(today, -2) })
      .expect(400);
  });
});
