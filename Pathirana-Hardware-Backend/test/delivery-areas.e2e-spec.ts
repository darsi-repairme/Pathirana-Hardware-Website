import type { INestApplication } from "@nestjs/common";
import type { Client } from "pg";
import request from "supertest";
import { pendingMigrations } from "../src/database/migrator";
import { createStaff, createTestApp, login } from "./helpers";

const EDITOR = { email: "delivery-editor@test.invalid", password: "Delivery-Editor-55" };

/** Area names below are isolated TEST data in the throwaway database only. */
describe("Delivery areas", () => {
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

  it("migrations are fully applied by the production runner", async () => {
    expect(await pendingMigrations(db)).toEqual([]);
  });

  it("answers honestly when no areas are listed", async () => {
    expect((await http.get("/api/v1/delivery-areas").expect(200)).body).toEqual({ items: [], total: 0 });
    const check = await http.get("/api/v1/delivery-areas/check").query({ area: "Anywhere" }).expect(200);
    expect(check.body).toEqual({ query: "Anywhere", supported: false, area: null, areasListed: false });
    await http.get("/api/v1/delivery-areas/check").expect(400);
  });

  it("supports admin CRUD, activation and safe archive", async () => {
    await http.post("/api/v1/admin/delivery-areas").send({ name: "Test Town" }).expect(401);
    const a = await http
      .post("/api/v1/admin/delivery-areas")
      .set(auth)
      .send({ name: "  Test   Town ", district: "Test District", postalCode: "12345" })
      .expect(201);
    expect(a.body).toMatchObject({ name: "Test Town", feeLkr: null, notes: null, isActive: true });
    await http
      .post("/api/v1/admin/delivery-areas")
      .set(auth)
      .send({ name: "test town", district: "test district" })
      .expect(409);
    await http
      .post("/api/v1/admin/delivery-areas")
      .set(auth)
      .send({ name: "Bad", postalCode: "12" })
      .expect(400);
    await http.post("/api/v1/admin/delivery-areas").set(auth).send({ name: "Bad", feeLkr: -5 }).expect(400);

    const b = await http
      .post("/api/v1/admin/delivery-areas")
      .set(auth)
      .send({ name: "Second Test Area", notes: "Test note", feeLkr: 250.5 })
      .expect(201);
    const upd = await http
      .patch(`/api/v1/admin/delivery-areas/${b.body.id}`)
      .set(auth)
      .send({ notes: "" })
      .expect(200);
    expect(upd.body.notes).toBeNull();

    // Public list + search + availability.
    const list = await http.get("/api/v1/delivery-areas").expect(200);
    expect(list.body.total).toBe(2);
    expect(list.body.items[0]).not.toHaveProperty("isActive");
    expect((await http.get("/api/v1/delivery-areas").query({ q: "second" }).expect(200)).body.total).toBe(1);
    const byName = await http.get("/api/v1/delivery-areas/check").query({ area: "  test TOWN " }).expect(200);
    expect(byName.body).toMatchObject({ supported: true, areasListed: true, area: { name: "Test Town" } });
    const byPostal = await http.get("/api/v1/delivery-areas/check").query({ area: "12345" }).expect(200);
    expect(byPostal.body.supported).toBe(true);
    const fee = await http
      .get("/api/v1/delivery-areas/check")
      .query({ area: "second test area" })
      .expect(200);
    // A staff-recorded fee is never exposed publicly (check or list); staff still see it.
    expect(fee.body.area).toMatchObject({ name: "Second Test Area" });
    expect(fee.body.area).not.toHaveProperty("feeLkr");
    const listed = await http.get("/api/v1/delivery-areas").expect(200);
    for (const item of listed.body.items) expect(item).not.toHaveProperty("feeLkr");
    expect(JSON.stringify(listed.body)).not.toContain("250.5");
    const staffView = await http.get("/api/v1/admin/delivery-areas").set(auth).expect(200);
    expect(staffView.body.items.find((x: { name: string }) => x.name === "Second Test Area").feeLkr).toBe(
      250.5,
    );
    const no = await http.get("/api/v1/delivery-areas/check").query({ area: "Elsewhere" }).expect(200);
    expect(no.body).toMatchObject({ supported: false, area: null, areasListed: true });

    // Deactivate → hidden publicly; archive → gone, name reusable, kept for admins.
    await http
      .patch(`/api/v1/admin/delivery-areas/${a.body.id}/status`)
      .set(auth)
      .send({ isActive: false })
      .expect(200);
    expect((await http.get("/api/v1/delivery-areas/check").query({ area: "Test Town" })).body.supported).toBe(
      false,
    );
    await http.delete(`/api/v1/admin/delivery-areas/${a.body.id}`).set(auth).expect(204);
    await http.delete(`/api/v1/admin/delivery-areas/${a.body.id}`).set(auth).expect(404);
    await http.patch(`/api/v1/admin/delivery-areas/${a.body.id}`).set(auth).send({ name: "X" }).expect(404);
    await http
      .post("/api/v1/admin/delivery-areas")
      .set(auth)
      .send({ name: "Test Town", district: "Test District" })
      .expect(201);
    const adminAll = await http
      .get("/api/v1/admin/delivery-areas")
      .query({ includeArchived: "true" })
      .set(auth)
      .expect(200);
    expect(adminAll.body.items).toHaveLength(3);
    const archivedRows = await db.query("SELECT 1 FROM delivery_areas WHERE archived_at IS NOT NULL");
    expect(archivedRows.rowCount).toBe(1);
    const audit = await db.query(
      "SELECT 1 FROM audit_log WHERE entity_type = 'delivery_area' AND action = 'delivery-area.archive'",
    );
    expect(audit.rowCount).toBe(1);
  });
});
