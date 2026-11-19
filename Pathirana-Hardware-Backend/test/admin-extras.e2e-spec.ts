import type { INestApplication } from "@nestjs/common";
import type { Client } from "pg";
import sharp from "sharp";
import request from "supertest";
import { createStaff, createTestApp, login } from "./helpers";

const ADMIN = { email: "extras-admin@test.invalid", password: "Extras-Admin-Pass-1" };
const EDITOR = { email: "extras-editor@test.invalid", password: "Extras-Editor-Pass-2" };

/** Batch 4 additions: dashboard, staff role/password, own password, staff image preview. */
describe("Admin extras", () => {
  let app: INestApplication;
  let db: Client;
  let http: ReturnType<typeof request>;
  let admin: { Authorization: string };
  let editor: { Authorization: string };

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    http = request(app.getHttpServer());
    await createStaff(db, ADMIN.email, "admin", ADMIN.password);
    await createStaff(db, EDITOR.email, "editor", EDITOR.password);
    admin = { Authorization: `Bearer ${await login(app, ADMIN.email, ADMIN.password)}` }; // login 1
    editor = { Authorization: `Bearer ${await login(app, EDITOR.email, EDITOR.password)}` }; // login 2
  });
  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it("dashboard returns real counts and hides staff events from editors", async () => {
    await http.get("/api/v1/admin/dashboard").expect(401);
    const before = await http.get("/api/v1/admin/dashboard").set(admin).expect(200);
    const cat = await http
      .post("/api/v1/admin/categories")
      .set(admin)
      .send({ name: "Extras Category" })
      .expect(201);
    const p = await http
      .post("/api/v1/admin/products")
      .set(admin)
      .send({ name: "Extras Product", categoryId: cat.body.id })
      .expect(201);
    await http
      .patch(`/api/v1/admin/products/${p.body.id}/publication`)
      .set(admin)
      .send({ published: true })
      .expect(200);
    const after = await http.get("/api/v1/admin/dashboard").set(editor).expect(200);
    expect(after.body.counts.products).toBe(before.body.counts.products + 1);
    expect(after.body.counts.publishedProducts).toBe(before.body.counts.publishedProducts + 1);
    expect(after.body.counts.categories).toBe(before.body.counts.categories + 1);
    expect(after.body.activity[0]).toMatchObject({ action: "product.publish", staffName: "Test admin" });
    expect(after.body.activity[0]).not.toHaveProperty("details");

    await db.query(
      "INSERT INTO audit_log (staff_id, action, entity_type, entity_id) SELECT id, 'staff.create', 'staff', id FROM staff WHERE email = $1",
      [ADMIN.email],
    );
    const forEditor = await http.get("/api/v1/admin/dashboard").set(editor).expect(200);
    expect(forEditor.body.activity.some((a: { entityType: string }) => a.entityType === "staff")).toBe(false);
    const forAdmin = await http.get("/api/v1/admin/dashboard").set(admin).expect(200);
    expect(forAdmin.body.activity[0].entityType).toBe("staff");
  });

  it("staff can preview images of unpublished products; the public cannot", async () => {
    const cat = await http
      .post("/api/v1/admin/categories")
      .set(editor)
      .send({ name: "Preview Category" })
      .expect(201);
    const p = await http
      .post("/api/v1/admin/products")
      .set(editor)
      .send({ name: "Draft Preview", categoryId: cat.body.id })
      .expect(201);
    const png = await sharp({ create: { width: 600, height: 400, channels: 3, background: "#b8860b" } })
      .png()
      .toBuffer();
    const img = await http
      .post(`/api/v1/admin/products/${p.body.id}/images`)
      .set(editor)
      .attach("file", png, "a.png")
      .field("altText", "Preview")
      .expect(201);
    await http.get(`/api/v1/product-images/${img.body.id}`).expect(404);
    await http.get(`/api/v1/admin/products/${p.body.id}/images/${img.body.id}`).expect(401);
    const res = await http
      .get(`/api/v1/admin/products/${p.body.id}/images/${img.body.id}`)
      .query({ size: "thumb" })
      .set(editor)
      .expect(200);
    expect(res.headers["content-type"]).toBe("image/webp");
    expect(res.headers["cache-control"]).toBe("private, no-store");
  });

  it("admins change roles and reset passwords; both sign the account out", async () => {
    const list = await http.get("/api/v1/admin/staff").set(admin).expect(200);
    const ed = list.body.find((s: { email: string }) => s.email === EDITOR.email);
    const me = list.body.find((s: { email: string }) => s.email === ADMIN.email);
    await http.patch(`/api/v1/admin/staff/${ed.id}/role`).set(editor).send({ role: "admin" }).expect(403);
    await http.patch(`/api/v1/admin/staff/${me.id}/role`).set(admin).send({ role: "editor" }).expect(400);
    await http.patch(`/api/v1/admin/staff/${ed.id}/role`).set(admin).send({ role: "owner" }).expect(400);

    const promoted = await http
      .patch(`/api/v1/admin/staff/${ed.id}/role`)
      .set(admin)
      .send({ role: "admin" })
      .expect(200);
    expect(promoted.body.role).toBe("admin");
    await http.get("/api/v1/auth/me").set(editor).expect(401); // old token revoked
    await http.patch(`/api/v1/admin/staff/${ed.id}/role`).set(admin).send({ role: "editor" }).expect(200);

    await http
      .patch(`/api/v1/admin/staff/${ed.id}/password`)
      .set(admin)
      .send({ password: "short" })
      .expect(400);
    await db.query("UPDATE staff SET locked_until = now() + interval '10 minutes' WHERE id = $1", [ed.id]);
    const reset = await http
      .patch(`/api/v1/admin/staff/${ed.id}/password`)
      .set(admin)
      .send({ password: "Brand-New-Editor-Pass-3" })
      .expect(200);
    expect(JSON.stringify(reset.body)).not.toMatch(/password|hash/i);
    const lock = await db.query("SELECT locked_until FROM staff WHERE id = $1", [ed.id]);
    expect(lock.rows[0].locked_until).toBeNull();
    await login(app, EDITOR.email, "Brand-New-Editor-Pass-3"); // login 3
    const audit = await db.query("SELECT details FROM audit_log WHERE action = 'staff.password-reset'");
    expect(JSON.stringify(audit.rows)).not.toContain("Brand-New-Editor-Pass-3");
  });

  it("staff change their own password with the current one; sessions end", async () => {
    await http
      .post("/api/v1/auth/password")
      .set(admin)
      .send({ currentPassword: "wrong-password", newPassword: "Another-Admin-Pass-4" })
      .expect(400);
    await http
      .post("/api/v1/auth/password")
      .set(admin)
      .send({ currentPassword: ADMIN.password, newPassword: "tiny" })
      .expect(400);
    await http
      .post("/api/v1/auth/password")
      .set(admin)
      .send({ currentPassword: ADMIN.password, newPassword: "Another-Admin-Pass-4" })
      .expect(204);
    await http.get("/api/v1/auth/me").set(admin).expect(401);
    await login(app, ADMIN.email, "Another-Admin-Pass-4"); // login 4
  });
});
