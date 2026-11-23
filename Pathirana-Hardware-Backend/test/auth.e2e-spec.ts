import type { INestApplication } from "@nestjs/common";
import type { Client } from "pg";
import request from "supertest";
import { createStaff, createTestApp, login, ORIGIN } from "./helpers";

const ADMIN = { email: "auth-admin@test.invalid", password: "Correct-Horse-Battery-9" };
const EDITOR = { email: "auth-editor@test.invalid", password: "Editor-Pass-Phrase-42" };

describe("Foundation and authentication", () => {
  let app: INestApplication;
  let db: Client;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    http = request(app.getHttpServer());
    await createStaff(db, ADMIN.email, "admin", ADMIN.password);
    await createStaff(db, EDITOR.email, "editor", EDITOR.password);
  });
  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it("GET /api/health reports the database and sets security headers", async () => {
    const res = await http.get("/api/health").expect(200);
    expect(res.body).toEqual({ status: "ok", database: "up" });
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(res.headers["x-request-id"]).toBeTruthy();
  });

  it("allows CORS only for configured origins", async () => {
    const ok = await http.get("/api/v1/categories").set("Origin", ORIGIN).expect(200);
    expect(ok.headers["access-control-allow-origin"]).toBe(ORIGIN);
    const other = await http.get("/api/v1/categories").set("Origin", "https://evil.test").expect(200);
    expect(other.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("returns one consistent error shape (unknown route, validation)", async () => {
    const missing = await http.get("/api/v1/nope").expect(404);
    expect(missing.body).toMatchObject({ statusCode: 404, error: "NOT_FOUND", path: "/api/v1/nope" });
    expect(missing.body.requestId).toBeTruthy();
    // Validation errors list every problem (login is not used here: it is rate-limited).
    const invalid = await http.get("/api/v1/products").query({ limit: 500, extra: 1 }).expect(400);
    expect(Array.isArray(invalid.body.message)).toBe(true);
    expect(invalid.body.message.join(" ")).toMatch(/limit/);
    expect(invalid.body.message.join(" ")).toMatch(/extra should not exist/);
  });

  it("protects staff endpoints", async () => {
    await http.get("/api/v1/auth/me").expect(401);
    await http.get("/api/v1/admin/categories").expect(401);
    await http.get("/api/v1/admin/categories").set("Authorization", "Bearer not.a.jwt").expect(401);
  });

  it("logs in, returns no secrets, and invalidates tokens on logout", async () => {
    const res = await http.post("/api/v1/auth/login").send(ADMIN).expect(200); // login 1
    const token = res.body.accessToken as string;
    expect(res.body.staff).toMatchObject({ email: ADMIN.email, role: "admin" });
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash/i);
    await http.get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`).expect(200);
    await http.post("/api/v1/auth/logout").set("Authorization", `Bearer ${token}`).expect(204);
    await http.get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`).expect(401);
  });

  it("enforces roles: editors cannot manage staff, admins can (deactivation revokes access)", async () => {
    const admin = await login(app, ADMIN.email, ADMIN.password); // login 2
    const editor = await login(app, EDITOR.email, EDITOR.password); // login 3
    await http.get("/api/v1/admin/staff").set("Authorization", `Bearer ${editor}`).expect(403);
    await http.get("/api/v1/admin/categories").set("Authorization", `Bearer ${editor}`).expect(200);

    const list = await http.get("/api/v1/admin/staff").set("Authorization", `Bearer ${admin}`).expect(200);
    expect(JSON.stringify(list.body)).not.toMatch(/password|hash|token_version/i);

    const weak = await http
      .post("/api/v1/admin/staff")
      .set("Authorization", `Bearer ${admin}`)
      .send({ email: "new@test.invalid", fullName: "New", role: "editor", password: "short" })
      .expect(400);
    expect(weak.body.message).toMatch(/at least 12/);

    const editorRow = list.body.find((s: { email: string }) => s.email === EDITOR.email);
    await http
      .patch(`/api/v1/admin/staff/${editorRow.id}/status`)
      .set("Authorization", `Bearer ${admin}`)
      .send({ isActive: false })
      .expect(200);
    await http.get("/api/v1/admin/categories").set("Authorization", `Bearer ${editor}`).expect(401);
  });

  it("locks an account after repeated failures without revealing it", async () => {
    await db.query("UPDATE staff SET failed_login_count = 4 WHERE email = $1", [ADMIN.email]);
    const wrong = await http.post("/api/v1/auth/login").send({ ...ADMIN, password: "wrong-password-1" }); // login 4
    expect(wrong.status).toBe(401);
    // Correct password while locked: same generic answer.
    const locked = await http.post("/api/v1/auth/login").send(ADMIN); // login 5
    expect(locked.status).toBe(401);
    expect(locked.body.message).toBe(wrong.body.message);
    const audit = await db.query("SELECT 1 FROM audit_log WHERE action = 'auth.locked'");
    expect(audit.rowCount).toBe(1);
  });

  it("rate-limits login attempts", async () => {
    const res = await http.post("/api/v1/auth/login").send({ email: "x@test.invalid", password: "whatever" }); // 6th
    expect(res.status).toBe(429);
  });
});
