import type { INestApplication } from "@nestjs/common";
import { createHmac } from "node:crypto";
import type { Client } from "pg";
import request from "supertest";
import { hashPassword } from "../src/auth/password";
import { createStaff, createTestApp } from "./helpers";

/**
 * Sign-in accepts ONLY an existing, active staff account with its correct password; every other
 * case gets the same generic answer (no hint whether an email exists). Isolated throwaway
 * database; all accounts are disposable test accounts.
 */
const ADMIN = { email: "rej-admin@test.invalid", password: "Rejections-Admin-Pass-1" };
const EDITOR = { email: "rej-editor@test.invalid", password: "Rejections-Editor-Pass-2" };
const INACTIVE = { email: "rej-inactive@test.invalid", password: "Rejections-Inactive-Pass-3" };
const DELETED = { email: "rej-deleted@test.invalid", password: "Rejections-Deleted-Pass-4" };
const PENDING = { email: "rej-pending@test.invalid" };
const INVALID = "Invalid email or password.";

describe("Sign-in rejections", () => {
  let app: INestApplication;
  let db: Client;
  let http: ReturnType<typeof request>;
  let ip = 0;
  // A fresh client address per attempt, so the per-minute limit never decides these results.
  const login = (body: object) =>
    http.post("/api/v1/auth/login").set("X-Forwarded-For", `10.92.0.${++ip}`).send(body);

  beforeAll(async () => {
    ({ app, db } = await createTestApp({ TRUST_PROXY: "true" }));
    http = request(app.getHttpServer());
    await createStaff(db, ADMIN.email, "admin", ADMIN.password);
    await createStaff(db, EDITOR.email, "editor", EDITOR.password);
    await createStaff(db, INACTIVE.email, "editor", INACTIVE.password);
    await db.query("UPDATE staff SET is_active = false WHERE email = $1", [INACTIVE.email]);
    await createStaff(db, DELETED.email, "editor", DELETED.password);
    await db.query("DELETE FROM staff WHERE email = $1", [DELETED.email]);
    // Created by an admin without a password (set-up link not used yet): an unusable random secret.
    await db.query(
      "INSERT INTO staff (email, full_name, role, password_hash) VALUES ($1, 'Pending', 'editor', $2)",
      [PENDING.email, await hashPassword("random-secret-nobody-knows-0123456789abcdef")],
    );
  });
  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it("accepts only an existing, active account with its correct password", async () => {
    const ok = await login(ADMIN).expect(200);
    expect(ok.body.staff).toMatchObject({ email: ADMIN.email, role: "admin" });
    expect(JSON.stringify(ok.body)).not.toMatch(/password|hash/i);
  });

  it("unknown, wrong, inactive, deleted and set-up-pending accounts: one generic 401", async () => {
    const cases = [
      { email: "qa.editor@example.invalid", password: "Any-Password-123" }, // looks real, not registered
      { email: ADMIN.email, password: "wrong-password-123" },
      { email: ADMIN.email.toUpperCase(), password: "wrong-password-123" },
      INACTIVE, // correct password, but deactivated
      DELETED, // correct password, but the account no longer exists
      { email: PENDING.email, password: "Any-Password-123" },
    ];
    for (const c of cases) {
      const r = await login(c).expect(401);
      expect(r.body.message).toBe(INVALID);
      expect(r.body).not.toHaveProperty("accessToken");
    }
  });

  it("blank or malformed input is refused before any account lookup (400)", async () => {
    for (const body of [
      {},
      { email: "", password: "" },
      { email: ADMIN.email, password: "" },
      { email: "", password: ADMIN.password },
      { email: "not-an-email", password: ADMIN.password },
      { email: ADMIN.email, password: ADMIN.password, role: "admin" }, // unknown field
      { email: [ADMIN.email], password: ADMIN.password },
    ]) {
      const r = await login(body).expect(400);
      expect(r.body).not.toHaveProperty("accessToken");
    }
  });

  it("tampered, foreign-key or unsigned tokens are rejected; editors cannot use admin-only endpoints", async () => {
    const editorToken = (await login(EDITOR).expect(200)).body.accessToken as string;
    const [h, p, s] = editorToken.split(".") as [string, string, string];
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const claims = JSON.parse(Buffer.from(p, "base64url").toString()) as Record<string, unknown>;
    const forged = [
      `${h}.${p}.${s.slice(0, -2)}${s.endsWith("AA") ? "BB" : "AA"}`, // changed signature
      `${h}.${b64({ ...claims, role: "admin" })}.${s}`, // changed role, old signature
      `${b64({ alg: "none", typ: "JWT" })}.${b64({ ...claims, role: "admin" })}.`, // unsigned
      (() => {
        // Correctly formed, but signed with a different secret.
        const head = b64({ alg: "HS256", typ: "JWT" });
        const body = b64({ ...claims, role: "admin" });
        const sig = createHmac("sha256", "not-the-server-secret-0123456789abcdef")
          .update(`${head}.${body}`)
          .digest("base64url");
        return `${head}.${body}.${sig}`;
      })(),
      "not-a-token",
    ];
    for (const t of forged) {
      await http.get("/api/v1/auth/me").set("Authorization", `Bearer ${t}`).expect(401);
      await http.get("/api/v1/admin/staff").set("Authorization", `Bearer ${t}`).expect(401);
    }
    // The genuine editor token works, but not for admin-only endpoints.
    await http.get("/api/v1/auth/me").set("Authorization", `Bearer ${editorToken}`).expect(200);
    for (const path of ["/api/v1/admin/staff", "/api/v1/admin/audit-log"]) {
      await http.get(path).set("Authorization", `Bearer ${editorToken}`).expect(403);
    }
  });
});
