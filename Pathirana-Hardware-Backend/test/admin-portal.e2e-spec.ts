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

  it("audit log filters: person (by id), action, Sri Lanka calendar days, and paging", async () => {
    // Two staff with the SAME display name: the filter must use the id, not the name.
    await createStaff(db, "twin-a@test.invalid", "admin", "Twin-A-Password-123");
    await createStaff(db, "twin-b@test.invalid", "admin", "Twin-B-Password-456");
    const ids = await db.query<{ id: string; email: string }>(
      "SELECT id, email FROM staff WHERE email LIKE 'twin-%' ORDER BY email",
    );
    const [a, b] = ids.rows.map((r) => r.id) as [string, string];
    // Entries in 2020 (far from anything else in this database), times in UTC; Colombo is +05:30.
    const rows: [string, string, string][] = [
      [a, "product.create", "2020-03-09T18:29:59Z"], // 9 March 23:59:59 in Colombo
      [a, "product.update", "2020-03-09T18:30:00Z"], // 10 March 00:00:00 in Colombo
      [a, "product.update", "2020-03-10T18:29:59Z"], // 10 March 23:59:59 in Colombo
      [b, "product.update", "2020-03-10T10:00:00Z"],
      [a, "brand.create", "2020-03-11T06:00:00Z"],
      ...Array.from({ length: 7 }, (_, i): [string, string, string] => [
        a,
        "gallery.add",
        `2020-04-0${i + 1}T06:00:00Z`,
      ]),
    ];
    for (const [staff, action, at] of rows) {
      await db.query(
        "INSERT INTO audit_log (staff_id, action, entity_type, created_at) VALUES ($1, $2, split_part($2, '.', 1), $3)",
        [staff, action, at],
      );
    }
    const get = async (qs: string) =>
      (await http.get(`/api/v1/admin/audit-log?${qs}`).set(admin).expect(200)).body as {
        items: { id: string; action: string; staffName: string }[];
        total: number;
      };

    // Person: only A's entries, although both are called "Test admin".
    const forA = await get(`staffId=${a}&from=2020-03-01&to=2020-03-31&limit=50`);
    expect(forA.total).toBe(4);
    const forB = await get(`staffId=${b}&from=2020-03-01&to=2020-03-31`);
    expect(forB.items.map((i) => i.action)).toEqual(["product.update"]);
    // Single day (10 March, Colombo): both midnight edges handled, 9 March 23:59:59 excluded.
    const day = await get(`staffId=${a}&from=2020-03-10&to=2020-03-10`);
    expect(day.total).toBe(2);
    expect(day.items.every((i) => i.action === "product.update")).toBe(true);
    // Action (+ person + range).
    expect((await get(`staffId=${a}&action=product.create&from=2020-03-01&to=2020-03-31`)).total).toBe(1);
    expect((await get(`action=brand.create&from=2020-03-11&to=2020-03-11`)).total).toBe(1);
    // Only a start / only an end date.
    expect((await get(`staffId=${a}&from=2020-04-01`)).total).toBe(7);
    expect((await get(`staffId=${a}&to=2020-03-09`)).total).toBe(1);
    // Paging a filtered list: 7 entries in pages of 3 → 3 + 3 + 1, no duplicates or gaps.
    const pages = await Promise.all(
      [1, 2, 3, 4].map((p) => get(`staffId=${a}&action=gallery.add&limit=3&page=${p}`)),
    );
    expect(pages.map((p) => p.items.length)).toEqual([3, 3, 1, 0]);
    expect(pages.every((p) => p.total === 7)).toBe(true);
    expect(new Set(pages.flatMap((p) => p.items.map((i) => i.id))).size).toBe(7);
    // No match: empty list, total 0.
    expect(await get(`staffId=${b}&action=gallery.add`)).toMatchObject({ items: [], total: 0 });

    // Invalid input is refused (400), never ignored.
    for (const qs of [
      "from=2020-03-11&to=2020-03-10",
      "from=2020-02-30",
      "to=10/03/2020",
      "staffId=Test%20admin",
    ]) {
      await http.get(`/api/v1/admin/audit-log?${qs}`).set(admin).expect(400);
    }
    // Still admins only, with or without filters.
    await http.get(`/api/v1/admin/audit-log?staffId=${a}`).set(editor).expect(403);
    await http.get(`/api/v1/admin/audit-log?staffId=${a}`).expect(401);
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
