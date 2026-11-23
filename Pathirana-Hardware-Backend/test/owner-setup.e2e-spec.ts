import type { INestApplication } from "@nestjs/common";
import type { Client } from "pg";
import request from "supertest";
import { createStaff, createTestApp, login } from "./helpers";
import { createOwnerCode, normaliseOwnerCode, verifyOwnerCode } from "../src/staff/owner-code";

/**
 * One-time Owner registration (first administrator) with a code from `npm run owner:code`.
 * Isolated throwaway database that starts with NO administrator — all accounts are TEST data.
 */
const SECRET = "integration-test-secret-0123456789abcdef"; // the test app's JWT_SECRET
const OWNER = { fullName: "Test Owner", email: "Test-Owner@Test.Invalid", password: "Owner-Test-Password-1" };
let ip = 0;

describe("Owner set-up codes", () => {
  it("format, look-alike characters, expiry, tampering and another server's secret", () => {
    const now = Date.UTC(2026, 10, 23, 8, 0);
    const { code, expiresAt } = createOwnerCode(SECRET, 30, now);
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
    expect(expiresAt.getTime()).toBe(now + 30 * 60_000);
    expect(verifyOwnerCode(SECRET, code, now)).toBe(true);
    expect(verifyOwnerCode(SECRET, ` ${code.toLowerCase().replace(/-/g, " ")} `, now)).toBe(true);
    expect(normaliseOwnerCode("o1il-")).toBe("0111");
    expect(verifyOwnerCode(SECRET, code, now + 31 * 60_000)).toBe(false); // expired
    expect(verifyOwnerCode("another-secret-0123456789abcdefghijkl", code, now)).toBe(false);
    const last = code.at(-1) === "0" ? "1" : "0";
    expect(verifyOwnerCode(SECRET, code.slice(0, -1) + last, now)).toBe(false); // tampered
    expect(verifyOwnerCode(SECRET, "AAAA-BBBB-CCCC-DDDD", now)).toBe(false);
    expect(verifyOwnerCode(SECRET, "too-short", now)).toBe(false);
    expect(() => createOwnerCode(SECRET, 0)).toThrow();
    expect(() => createOwnerCode(SECRET, 1441)).toThrow();
  });
});

describe("Owner registration", () => {
  let app: INestApplication;
  let db: Client;
  let http: ReturnType<typeof request>;
  const post = (body: object) =>
    http.post("/api/v1/auth/owner-setup").set("X-Forwarded-For", `10.90.0.${++ip}`).send(body);
  const valid = () => createOwnerCode(SECRET, 30).code;

  beforeAll(async () => {
    ({ app, db } = await createTestApp({ TRUST_PROXY: "true" }));
    http = request(app.getHttpServer());
    // A normal editor may exist already; registration stays open until an ADMIN exists.
    await createStaff(db, "existing-editor@test.invalid", "editor", "Existing-Editor-Password-1");
  });
  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it("is open while there is no administrator", async () => {
    expect((await http.get("/api/v1/auth/owner-setup").expect(200)).body).toEqual({ open: true });
  });

  it("refuses wrong, expired and tampered codes, mismatched or weak passwords, unknown fields", async () => {
    const base = { ...OWNER, confirmPassword: OWNER.password };
    for (const code of ["AAAA-BBBB-CCCC-DDDD", createOwnerCode(SECRET, 1, Date.now() - 5 * 60_000).code]) {
      const r = await post({ ...base, code }).expect(400);
      expect(r.body.message).toBe("This verification code is not valid or has expired.");
    }
    const other = createOwnerCode("a-different-server-secret-0123456789ab", 30).code;
    await post({ ...base, code: other }).expect(400);
    const mismatch = await post({ ...base, code: valid(), confirmPassword: "Something-Else-123" }).expect(
      400,
    );
    expect(mismatch.body.message).toBe("The passwords do not match.");
    await post({ ...base, code: valid(), password: "short", confirmPassword: "short" }).expect(400);
    await post({ ...base, code: valid(), email: "not-an-email" }).expect(400);
    await post({ ...base, code: valid(), role: "admin", isAdmin: true }).expect(400); // no extra fields
    const n = await db.query("SELECT count(*)::int AS n FROM staff WHERE role = 'admin'");
    expect(n.rows[0].n).toBe(0);
  });

  it("concurrent registrations with valid codes create exactly ONE Owner", async () => {
    const attempts = await Promise.all(
      [1, 2, 3].map((i) =>
        post({
          code: valid(),
          fullName: `${OWNER.fullName} ${i}`,
          email: i === 1 ? OWNER.email : `owner-${i}@test.invalid`,
          password: OWNER.password,
          confirmPassword: OWNER.password,
        }),
      ),
    );
    expect(attempts.filter((r) => r.status === 201)).toHaveLength(1);
    expect(attempts.filter((r) => r.status === 410)).toHaveLength(2);
    const admins = await db.query<{ email: string; role: string; password_hash: string }>(
      "SELECT email, role, password_hash FROM staff WHERE role = 'admin'",
    );
    expect(admins.rows).toHaveLength(1);
    // Stored as a slow hash, never the password itself; email in lower case.
    expect(admins.rows[0]!.password_hash).not.toContain(OWNER.password);
    expect(admins.rows[0]!.password_hash).toMatch(/^\$(argon2|scrypt|2[aby]\$)/);
  });

  it("is then closed: the same and new codes are refused, and status says closed", async () => {
    const r = await post({
      ...OWNER,
      code: valid(),
      confirmPassword: OWNER.password,
      email: "late@test.invalid",
    });
    expect(r.status).toBe(410);
    expect(r.body.message).toMatch(/Owner registration is closed/);
    expect((await http.get("/api/v1/auth/owner-setup").expect(200)).body).toEqual({ open: false });
    const audit = await db.query(
      "SELECT count(*)::int AS n FROM audit_log WHERE action = 'staff.create-owner'",
    );
    expect(audit.rows[0].n).toBe(1);
  });

  it("the Owner signs in normally as an administrator and can manage staff", async () => {
    const [owner] = (await db.query<{ email: string }>("SELECT email FROM staff WHERE role = 'admin'")).rows;
    const token = await login(app, owner!.email, OWNER.password);
    const auth = { Authorization: `Bearer ${token}` };
    const me = await http.get("/api/v1/auth/me").set(auth).expect(200);
    expect(me.body.role ?? me.body.staff?.role).toBe("admin");
    await http.get("/api/v1/admin/staff").set(auth).expect(200);
    await http.get("/api/v1/admin/dashboard").set(auth).expect(200);
    // Normal staff onboarding still works for the Owner.
    await http
      .post("/api/v1/admin/staff")
      .set(auth)
      .send({ email: "new-editor@test.invalid", fullName: "Test New Editor", role: "editor" })
      .expect(201);
  });

  it("offers no public sign-up anywhere else", async () => {
    await http.post("/api/v1/auth/register").send({}).expect(404);
    await http.post("/api/v1/auth/signup").send({}).expect(404);
    await http
      .post("/api/v1/admin/staff")
      .send({ email: "x@test.invalid", fullName: "X", role: "admin" })
      .expect(401);
  });
});
