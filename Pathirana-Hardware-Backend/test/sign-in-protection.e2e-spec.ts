import type { INestApplication } from "@nestjs/common";
import type { Client } from "pg";
import request from "supertest";
import { ACCOUNT_MAX_FAILURES, AuthService } from "../src/auth/auth.service";
import { CLIENT_ID_HEADER, CLIENT_SIG_HEADER, signClientId } from "../src/common/client-identity";
import { createStaff, createTestApp, login } from "./helpers";

/**
 * Security regressions for the tester's sign-in findings:
 * - atomic failure counting under concurrency (no lost updates),
 * - a stranger cannot lock staff out (failures are limited per client source),
 * - rate limits: signed-in staff and different clients do not share one budget; client
 *   identities are accepted only with the Admin server's signature.
 */
const SECRET = "test-admin-client-secret-0123456789abcdef";
const OWNER = { email: "owner@test.invalid", password: "Owner-Pass-Phrase-77" };
const EDITOR = { email: "editor@test.invalid", password: "Editor-Pass-Phrase-88" };
const RACE = { email: "race@test.invalid", password: "Race-Pass-Phrase-99" };

const signed = (id: string) => ({ [CLIENT_ID_HEADER]: id, [CLIENT_SIG_HEADER]: signClientId(SECRET, id) });

describe("Sign-in protection", () => {
  let app: INestApplication;
  let db: Client;
  let http: ReturnType<typeof request>;
  let auth: AuthService;
  const count = async (email: string) =>
    (
      await db.query<{ failed_login_count: number; locked: boolean }>(
        "SELECT failed_login_count, coalesce(locked_until > now(), false) AS locked FROM staff WHERE email = $1",
        [email],
      )
    ).rows[0]!;

  beforeAll(async () => {
    ({ app, db } = await createTestApp({ ADMIN_CLIENT_SECRET: SECRET }));
    http = request(app.getHttpServer());
    auth = app.get(AuthService);
    await createStaff(db, OWNER.email, "admin", OWNER.password);
    await createStaff(db, EDITOR.email, "editor", EDITOR.password);
    await createStaff(db, RACE.email, "editor", RACE.password);
  });
  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  // ── Bug 1: non-atomic failure counter ─────────────────────────────────────
  it("counts every concurrent failed sign-in (no lost updates)", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) => auth.login(RACE.email, "wrong-password-x", `test:race-${i}`)),
    );
    expect(results.every((r) => r.status === "rejected")).toBe(true);
    expect((await count(RACE.email)).failed_login_count).toBe(10);
  });

  it("locks exactly once when concurrent failures cross the account-wide limit", async () => {
    await db.query("UPDATE staff SET failed_login_count = $2, locked_until = NULL WHERE email = $1", [
      RACE.email,
      ACCOUNT_MAX_FAILURES - 2,
    ]);
    await db.query("DELETE FROM audit_log WHERE action = 'auth.locked'");
    await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) => auth.login(RACE.email, "wrong-password-y", `test:lock-${i}`)),
    );
    const after = await count(RACE.email);
    expect(after.locked).toBe(true);
    const audits = await db.query("SELECT 1 FROM audit_log WHERE action = 'auth.locked'");
    expect(audits.rowCount).toBe(1);
    // Locked: even the correct password is refused (generic error).
    await expect(auth.login(RACE.email, RACE.password, "test:other")).rejects.toThrow(
      "Invalid email or password.",
    );
  });

  it("an expired lock lets the correct password in and resets the counter", async () => {
    await db.query(
      "UPDATE staff SET locked_until = now() - interval '1 second', failed_login_count = 3 WHERE email = $1",
      [RACE.email],
    );
    const ok = await auth.login(RACE.email, RACE.password, "test:after-lock");
    expect(ok.accessToken).toBeTruthy();
    expect(await count(RACE.email)).toEqual({ failed_login_count: 0, locked: false });
  });

  // ── Bug 2: unauthenticated lockout of a known account ─────────────────────
  it("a stranger's failures block only the stranger, not the owner on another device", async () => {
    const stranger = "test:stranger";
    for (let i = 0; i < 5; i++) {
      await expect(auth.login(OWNER.email, `guess-${i}-wrong-pw`, stranger)).rejects.toThrow();
    }
    // The stranger is now refused even with the right password (and cannot tell).
    await expect(auth.login(OWNER.email, OWNER.password, stranger)).rejects.toThrow(
      "Invalid email or password.",
    );
    // The account itself is NOT locked: the owner signs in from their own device.
    expect((await count(OWNER.email)).locked).toBe(false);
    const ok = await auth.login(OWNER.email, OWNER.password, "test:owner-laptop");
    expect(ok.staff.email).toBe(OWNER.email);
    // Unknown emails are limited the same way (no hint that the address does not exist).
    for (let i = 0; i < 6; i++) {
      await expect(auth.login("nobody@test.invalid", "whatever-pw", stranger)).rejects.toThrow(
        "Invalid email or password.",
      );
    }
  });

  it("an administrator's password reset lifts the per-source blocks", async () => {
    const src = "test:forgetful";
    for (let i = 0; i < 5; i++)
      await expect(auth.login(EDITOR.email, `nope-${i}-wrong`, src)).rejects.toThrow();
    await expect(auth.login(EDITOR.email, EDITOR.password, src)).rejects.toThrow();
    const admin = await login(app, OWNER.email, OWNER.password);
    const list = await http.get("/api/v1/admin/staff").set("Authorization", `Bearer ${admin}`).expect(200);
    const editor = list.body.find((s: { email: string }) => s.email === EDITOR.email);
    const fresh = "Editor-New-Pass-Phrase-11";
    await http
      .patch(`/api/v1/admin/staff/${editor.id}/password`)
      .set("Authorization", `Bearer ${admin}`)
      .send({ password: fresh })
      .expect(200);
    const ok = await auth.login(EDITOR.email, fresh, src);
    expect(ok.staff.email).toBe(EDITOR.email);
    EDITOR.password = fresh;
  });

  // ── Bug 5 (API side): sign-out revokes every session ──────────────────────
  it("sign-out ends the sessions on ALL devices; revoked tokens cannot be reused", async () => {
    const signIn = async (device: string) =>
      (await http.post("/api/v1/auth/login").set(signed(device)).send(OWNER).expect(200)).body
        .accessToken as string;
    const laptop = await signIn("dev:Owner_Laptop_Device_01");
    const phone = await signIn("dev:Owner_Phone_Device_002");
    await http.get("/api/v1/auth/me").set("Authorization", `Bearer ${phone}`).expect(200);
    await http.post("/api/v1/auth/logout").set("Authorization", `Bearer ${laptop}`).expect(204);
    for (const t of [laptop, phone]) {
      await http.get("/api/v1/auth/me").set("Authorization", `Bearer ${t}`).expect(401);
      await http.get("/api/v1/admin/categories").set("Authorization", `Bearer ${t}`).expect(401);
      // A revoked token cannot sign out (or do anything) again.
      await http.post("/api/v1/auth/logout").set("Authorization", `Bearer ${t}`).expect(401);
    }
  });

  // ── Bug 4: shared rate-limit bucket ───────────────────────────────────────
  it("signed client identities get separate sign-in budgets; forged ones do not", async () => {
    const email = "budget@test.invalid";
    const send = (headers: Record<string, string>) =>
      http.post("/api/v1/auth/login").set(headers).send({ email, password: "whatever-pw" });
    for (let i = 0; i < 5; i++) expect((await send(signed("ip:10.0.0.1"))).status).toBe(401);
    expect((await send(signed("ip:10.0.0.1"))).status).toBe(429);
    // A different (signed) device of a staff member is unaffected.
    expect((await send(signed("dev:Remembered_Device_0001"))).status).toBe(401);
    // Forged identities (bad signature) and X-Forwarded-For are ignored: all one bucket.
    const forged = (n: number) => ({
      [CLIENT_ID_HEADER]: `ip:10.9.9.${n}`,
      [CLIENT_SIG_HEADER]: "0".repeat(64),
      "X-Forwarded-For": `203.0.113.${n}`,
    });
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await send(forged(i))).status);
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses[5]).toBe(429);
  });

  it("signed-in staff keep working when an anonymous client uses up the shared budget", async () => {
    const token = await login(app, OWNER.email, OWNER.password);
    let limited = false;
    for (let i = 0; i < 130 && !limited; i++) {
      limited = (await http.get("/api/v1/categories")).status === 429;
    }
    expect(limited).toBe(true);
    // Same address, but a signed-in staff member: own budget.
    await http.get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`).expect(200);
    await http.get("/api/v1/admin/categories").set("Authorization", `Bearer ${token}`).expect(200);
    // An invalid token does not escape the anonymous limit.
    await http.get("/api/v1/categories").set("Authorization", "Bearer not.a.valid.token").expect(429);
  });

  // Manual preview test (2026-11-25): sign in, sign out, then 5 wrong passwords within one minute,
  // wait a minute, right password → signed in. The 5th attempt was a 429 from the per-minute limit
  // (5 per source + email, the earlier sign-in counted too): its password was never checked, so
  // only 4 failures were counted. Checked failures still block the source for 15 minutes.
  it("a throttled (429) attempt is not a counted failure; 5 checked failures block that source", async () => {
    const QA = { email: "qa-new-admin@test.invalid", password: "Qa-New-Admin-Pass-55" };
    await createStaff(db, QA.email, "admin", QA.password);
    const send = (password: string, device = "dev:Manual_Test_Device_0001") =>
      http.post("/api/v1/auth/login").set(signed(device)).send({ email: QA.email, password });
    // "Waited a minute": the API clock moves 61 s on (the per-minute limit ends, 15 minutes do not).
    const realNow = Date.now.bind(Date);
    let offset = 0;
    const clock = jest.spyOn(Date, "now").mockImplementation(() => realNow() + offset);
    const aMinuteLater = () => (offset += 61_000);
    try {
      // What happened in the preview.
      expect((await send(QA.password)).status).toBe(200);
      const statuses: number[] = [];
      for (let i = 0; i < 5; i++) statuses.push((await send(`wrong-${i}-pw`)).status);
      expect(statuses).toEqual([401, 401, 401, 401, 429]);
      aMinuteLater();
      expect((await send(QA.password)).status).toBe(200); // only 4 failures were counted

      // Intended behaviour: 5 wrong passwords that are checked → this source is refused even with
      // the right password after the minute limit has passed; the person's other device is not.
      aMinuteLater();
      for (let i = 0; i < 5; i++) expect((await send(`wrong-${i}-pw`)).status).toBe(401);
      aMinuteLater();
      expect((await send(QA.password)).status).toBe(401);
      expect((await send(QA.password, "dev:Other_Staff_Device_0002")).status).toBe(200);
      expect((await count(QA.email)).locked).toBe(false);
    } finally {
      clock.mockRestore();
    }
  });
});
