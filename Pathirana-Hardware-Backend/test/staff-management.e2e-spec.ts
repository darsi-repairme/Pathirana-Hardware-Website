import type { INestApplication } from "@nestjs/common";
import type { Client } from "pg";
import request from "supertest";
import { createStaff, createTestApp } from "./helpers";

/**
 * Staff management (migration 0008): create without a password, one-time set-up / reset
 * links (hash only, 24 h, single use), edit, role and status changes, last-admin protection,
 * editors refused. Isolated throwaway database — every account here is TEST data.
 */
const ADMIN = { email: "staff-admin@test.invalid", password: "Staff-Admin-Password-1" };
const EDITOR = { email: "staff-editor@test.invalid", password: "Staff-Editor-Password-2" };

describe("Staff management", () => {
  let app: INestApplication;
  let db: Client;
  let http: ReturnType<typeof request>;
  let admin: { Authorization: string };
  let editor: { Authorization: string };
  let adminId: string;

  beforeAll(async () => {
    ({ app, db } = await createTestApp({ TRUST_PROXY: "true" }));
    http = request(app.getHttpServer());
    await createStaff(db, ADMIN.email, "admin", ADMIN.password);
    await createStaff(db, EDITOR.email, "editor", EDITOR.password);
    admin = { Authorization: `Bearer ${await loginAs(ADMIN.email, ADMIN.password)}` };
    editor = { Authorization: `Bearer ${await loginAs(EDITOR.email, EDITOR.password)}` };
    adminId = (await db.query("SELECT id FROM staff WHERE email = $1", [ADMIN.email])).rows[0].id;
  });
  // The set-up endpoint is rate-limited per client (5/min): each call uses its own test address.
  let ip = 0;
  const nextIp = () => `10.55.${Math.floor(++ip / 200)}.${ip % 200}`;
  const setup = () => http.post("/api/v1/auth/password-setup").set("X-Forwarded-For", nextIp());
  const setupCheck = () => http.get("/api/v1/auth/password-setup").set("X-Forwarded-For", nextIp());
  const loginAs = async (email: string, password: string) =>
    (
      await http
        .post("/api/v1/auth/login")
        .set("X-Forwarded-For", nextIp())
        .send({ email, password })
        .expect(200)
    ).body.accessToken as string;
  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it("401 without a session, 403 for editors on every staff endpoint", async () => {
    await http.get("/api/v1/admin/staff").expect(401);
    const editorId = (await db.query("SELECT id FROM staff WHERE email = $1", [EDITOR.email])).rows[0].id;
    for (const [m, path, body] of [
      ["get", "/api/v1/admin/staff", undefined],
      ["post", "/api/v1/admin/staff", { email: "x@test.invalid", fullName: "X", role: "editor" }],
      ["patch", `/api/v1/admin/staff/${adminId}`, { fullName: "Hacked" }],
      ["patch", `/api/v1/admin/staff/${adminId}/status`, { isActive: false }],
      ["patch", `/api/v1/admin/staff/${editorId}/role`, { role: "admin" }],
      ["post", `/api/v1/admin/staff/${adminId}/password-link`, { purpose: "reset" }],
    ] as const) {
      const r = (http as unknown as Record<string, (p: string) => request.Test>)[m]!(path).set(editor);
      await (body ? r.send(body) : r).expect(403);
    }
    expect(
      (await db.query("SELECT full_name FROM staff WHERE id = $1", [adminId])).rows[0].full_name,
    ).not.toBe("Hacked");
  });

  it("owner onboarding: create without a password → one-time link → own password → sign in", async () => {
    // Validation first.
    await http
      .post("/api/v1/admin/staff")
      .set(admin)
      .send({ email: "bad", fullName: "Owner", role: "admin" })
      .expect(400);
    await http
      .post("/api/v1/admin/staff")
      .set(admin)
      .send({ email: "o@test.invalid", fullName: "", role: "admin" })
      .expect(400);
    await http
      .post("/api/v1/admin/staff")
      .set(admin)
      .send({ email: "o@test.invalid", fullName: "Owner", role: "superuser" })
      .expect(400);

    const created = await http
      .post("/api/v1/admin/staff")
      .set(admin)
      .send({ email: "Test.Owner@Test.Invalid", fullName: "Test Owner", role: "admin" })
      .expect(201);
    expect(created.body).toMatchObject({ email: "test.owner@test.invalid", role: "admin", isActive: true });
    expect(JSON.stringify(created.body)).not.toMatch(/hash|password/i);
    // Duplicate email (case-insensitive) → 409.
    await http
      .post("/api/v1/admin/staff")
      .set(admin)
      .send({ email: "test.owner@test.invalid", fullName: "Dup", role: "editor" })
      .expect(409);
    // No usable password yet.
    await http
      .post("/api/v1/auth/login")
      .send({ email: "test.owner@test.invalid", password: "anything-at-all-123" })
      .expect(401);

    const link = await http
      .post(`/api/v1/admin/staff/${created.body.id}/password-link`)
      .set(admin)
      .send({ purpose: "setup" })
      .expect(201);
    expect(link.body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    // Only the hash is stored.
    const stored = (
      await db.query("SELECT token_hash FROM staff_password_tokens WHERE staff_id = $1", [created.body.id])
    ).rows[0].token_hash;
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
    expect(stored).not.toContain(link.body.token);

    const check = await setupCheck().query({ token: link.body.token }).expect(200);
    expect(check.body).toMatchObject({ fullName: "Test Owner", purpose: "setup" });
    expect(JSON.stringify(check.body)).not.toMatch(/@|role/);
    await setup().send({ token: link.body.token, password: "short" }).expect(400);
    await setup().send({ token: link.body.token, password: "Owner-Chosen-Password-9" }).expect(204);
    // Single use.
    await setup().send({ token: link.body.token, password: "Another-Password-1234" }).expect(410);
    await setupCheck().query({ token: link.body.token }).expect(410);
    const ownerToken = await loginAs("test.owner@test.invalid", "Owner-Chosen-Password-9");
    // The new owner can manage staff independently.
    await http.get("/api/v1/admin/staff").set("Authorization", `Bearer ${ownerToken}`).expect(200);
    const audit = (
      await db.query("SELECT action FROM audit_log WHERE entity_id = $1 ORDER BY id", [created.body.id])
    ).rows.map((r) => r.action);
    expect(audit).toEqual(["staff.create", "staff.password-link.setup", "staff.password-setup.complete"]);
  });

  it("links: expired, unknown and replaced links are refused with one message; reset ends sessions", async () => {
    const s = await http
      .post("/api/v1/admin/staff")
      .set(admin)
      .send({ email: "reset@test.invalid", fullName: "Reset Person", role: "editor" })
      .expect(201);
    const first = await http
      .post(`/api/v1/admin/staff/${s.body.id}/password-link`)
      .set(admin)
      .send({ purpose: "setup" });
    const second = await http
      .post(`/api/v1/admin/staff/${s.body.id}/password-link`)
      .set(admin)
      .send({ purpose: "setup" });
    // Issuing a new link voids the earlier one.
    await setup().send({ token: first.body.token, password: "Valid-Password-1234" }).expect(410);
    await setup().send({ token: second.body.token, password: "Valid-Password-1234" }).expect(204);
    const session = await loginAs("reset@test.invalid", "Valid-Password-1234");
    // Expired link.
    const third = await http
      .post(`/api/v1/admin/staff/${s.body.id}/password-link`)
      .set(admin)
      .send({ purpose: "reset" });
    await db.query(
      "UPDATE staff_password_tokens SET created_at = now() - interval '2 days', expires_at = now() - interval '1 day' WHERE used_at IS NULL",
    );
    await setup().send({ token: third.body.token, password: "Newer-Password-1234" }).expect(410);
    // Malformed / unknown.
    await setup().send({ token: "abc", password: "Newer-Password-1234" }).expect(400);
    await setup()
      .send({ token: "A".repeat(43), password: "Newer-Password-1234" })
      .expect(410);
    // A completed reset ends existing sessions.
    const fourth = await http
      .post(`/api/v1/admin/staff/${s.body.id}/password-link`)
      .set(admin)
      .send({ purpose: "reset" });
    await setup().send({ token: fourth.body.token, password: "Reset-Password-5678" }).expect(204);
    await http.get("/api/v1/auth/me").set("Authorization", `Bearer ${session}`).expect(401);
  });

  it("edit name/email; deactivate/reactivate; role change; last active admin is protected", async () => {
    const s = await http
      .post("/api/v1/admin/staff")
      .set(admin)
      .send({ email: "edit@test.invalid", fullName: "Edit Person", role: "editor" })
      .expect(201);
    const upd = await http
      .patch(`/api/v1/admin/staff/${s.body.id}`)
      .set(admin)
      .send({ fullName: "Edited Person", email: "edited@test.invalid" })
      .expect(200);
    expect(upd.body).toMatchObject({ fullName: "Edited Person", email: "edited@test.invalid" });
    await http.patch(`/api/v1/admin/staff/${s.body.id}`).set(admin).send({ email: ADMIN.email }).expect(409);
    await http
      .patch(`/api/v1/admin/staff/${s.body.id}`)
      .set(admin)
      .send({ email: "not-an-email" })
      .expect(400);
    await http.patch(`/api/v1/admin/staff/${s.body.id}`).set(admin).send({}).expect(400);

    await http
      .patch(`/api/v1/admin/staff/${s.body.id}/status`)
      .set(admin)
      .send({ isActive: false })
      .expect(200);
    // A deactivated account gets no link.
    await http
      .post(`/api/v1/admin/staff/${s.body.id}/password-link`)
      .set(admin)
      .send({ purpose: "reset" })
      .expect(400);
    await http
      .patch(`/api/v1/admin/staff/${s.body.id}/status`)
      .set(admin)
      .send({ isActive: true })
      .expect(200);

    // Role changes take effect at once (the account is signed out), and admins can be demoted
    // while another active admin exists; your own role / status cannot be changed (so the last
    // active admin can never remove themselves).
    const other = await http
      .post("/api/v1/admin/staff")
      .set(admin)
      .send({ email: "second-admin@test.invalid", fullName: "Second Admin", role: "admin" })
      .expect(201);
    const link = await http
      .post(`/api/v1/admin/staff/${other.body.id}/password-link`)
      .set(admin)
      .send({ purpose: "setup" });
    await setup().send({ token: link.body.token, password: "Second-Admin-Pass-1" }).expect(204);
    const second = {
      Authorization: `Bearer ${await loginAs("second-admin@test.invalid", "Second-Admin-Pass-1")}`,
    };
    await http.get("/api/v1/admin/staff").set(second).expect(200);
    await http
      .patch(`/api/v1/admin/staff/${other.body.id}/role`)
      .set(admin)
      .send({ role: "editor" })
      .expect(200);
    await http.get("/api/v1/admin/staff").set(second).expect(401); // old session ended by the role change
    await http
      .patch(`/api/v1/admin/staff/${adminId}/status`)
      .set(admin)
      .send({ isActive: false })
      .expect(400);
    await http.patch(`/api/v1/admin/staff/${adminId}/role`).set(admin).send({ role: "editor" }).expect(400);
    // Deactivation revokes access immediately.
    await http
      .patch(`/api/v1/admin/staff/${other.body.id}/role`)
      .set(admin)
      .send({ role: "admin" })
      .expect(200);
    const relink = await http
      .post(`/api/v1/admin/staff/${other.body.id}/password-link`)
      .set(admin)
      .send({ purpose: "reset" });
    await setup().send({ token: relink.body.token, password: "Second-Admin-Pass-2" }).expect(204);
    const again = {
      Authorization: `Bearer ${await loginAs("second-admin@test.invalid", "Second-Admin-Pass-2")}`,
    };
    await http
      .patch(`/api/v1/admin/staff/${other.body.id}/status`)
      .set(admin)
      .send({ isActive: false })
      .expect(200);
    await http.get("/api/v1/auth/me").set(again).expect(401);
  });
});
