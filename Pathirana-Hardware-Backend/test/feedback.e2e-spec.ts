import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import type { Client } from "pg";
import request from "supertest";
import { createStaff, createTestApp, login } from "./helpers";

/**
 * Customer feedback (migration 0007). Isolated throwaway database: every name
 * and message here is TEST data and never reaches a permanent database.
 */
const ADMIN = { email: "fb-admin@test.invalid", password: "Feedback-Admin-Password-1" };
const EDITOR = { email: "fb-editor@test.invalid", password: "Feedback-Editor-Password-2" };

let ip = 0;
const nextIp = () => `10.88.${Math.floor(++ip / 200)}.${ip % 200}`;

describe("Customer feedback", () => {
  let app: INestApplication;
  let db: Client;
  let http: ReturnType<typeof request>;
  let admin: { Authorization: string };
  let editor: { Authorization: string };

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

  let n = 0;
  const base = (over: Record<string, unknown> = {}) => ({
    idempotencyKey: randomUUID(),
    name: `Test Customer ${++n}`,
    rating: 5,
    message: `Test feedback message number ${n} for the isolated test database.`,
    location: "Test Town",
    language: "en",
    consent: true,
    consentVersion: "2026-11-20",
    ...over,
  });
  const submit = (body: unknown, from = nextIp()) =>
    http
      .post("/api/v1/feedback")
      .set("X-Forwarded-For", from)
      .send(body as object);
  const idOf = async (name: string) =>
    (await db.query<{ id: string }>("SELECT id FROM customer_feedback WHERE display_name = $1", [name]))
      .rows[0]!.id;
  const publicNames = async () =>
    ((await http.get("/api/v1/feedback").expect(200)).body.items as { name: string }[]).map((i) => i.name);

  it("saves a valid submission as pending and returns no internal data", async () => {
    const body = base();
    const res = await submit(body).expect(201);
    expect(res.body).toEqual({ status: "pending", duplicate: false });
    const row = (await db.query("SELECT * FROM customer_feedback WHERE display_name = $1", [body.name]))
      .rows[0];
    expect(row.status).toBe("pending");
    expect(row.publish_consent).toBe(true);
    expect(row.consent_version).toBe("2026-11-20");
    expect(row.moderated_at).toBeNull();
  });

  it("keeps pending feedback out of the public list", async () => {
    const body = base();
    await submit(body).expect(201);
    expect(await publicNames()).not.toContain(body.name);
  });

  it.each([
    ["missing name", { name: undefined }],
    ["one-letter name", { name: "A" }],
    ["rating 0", { rating: 0 }],
    ["rating 6", { rating: 6 }],
    ["fractional rating", { rating: 4.5 }],
    ["empty message", { message: "   " }],
    ["too short message", { message: "ok" }],
    ["too long message", { message: "x".repeat(1001) }],
    ["too long name", { name: "N".repeat(61) }],
    ["no consent", { consent: false }],
    ["unknown consent version", { consentVersion: "1999-01-01" }],
    ["unknown language", { language: "fr" }],
    ["link in message", { message: "Great prices, see https://spam.example for more" }],
    ["unknown field", { email: "x@test.invalid" }],
    ["status injection", { status: "approved" }],
  ])("rejects %s", async (_label, over) => {
    const body = base(over);
    const res = await submit(body).expect(400);
    expect(res.body.message).toBeDefined();
    const c = await db.query("SELECT count(*)::int AS n FROM customer_feedback WHERE idempotency_key = $1", [
      body.idempotencyKey,
    ]);
    expect(c.rows[0].n).toBe(0);
  });

  it("refuses a filled honeypot without saving", async () => {
    const body = base({ website: "http://bot.example" });
    await submit(body).expect(400);
    expect(
      (await db.query("SELECT 1 FROM customer_feedback WHERE display_name = $1", [body.name])).rowCount,
    ).toBe(0);
  });

  it("accepts Tamil and Sinhala text, keeping joiners intact", async () => {
    const ta = base({
      name: "தமிழ் வாடிக்கையாளர்",
      message: "மிகவும் நல்ல சேவை, நன்றி. சோதனை செய்தி.",
      language: "ta",
    });
    // "ශ්‍රී" uses U+200D (zero-width joiner) — it must survive cleaning.
    const zwj = String.fromCharCode(0x200d);
    const si = base({
      name: "සිංහල පාරිභෝගිකයා",
      message: `ශ්${zwj}රී ලංකාවේ හොඳම සේවාව. පරීක්ෂණ පණිවිඩය.`,
      language: "si",
    });
    await submit(ta).expect(201);
    await submit(si).expect(201);
    const row = (
      await db.query("SELECT message, language FROM customer_feedback WHERE display_name = $1", [si.name])
    ).rows[0];
    expect(row.message).toBe(si.message);
    expect(row.message).toContain(String.fromCharCode(0x200d));
    expect(row.language).toBe("si");
  });

  it("treats a retried form and identical feedback as duplicates", async () => {
    const body = base();
    await submit(body).expect(201);
    const again = await submit(body).expect(201);
    expect(again.body).toEqual({ status: "pending", duplicate: true });
    const same = await submit({ ...body, idempotencyKey: randomUUID(), rating: 4 }).expect(201);
    expect(same.body.duplicate).toBe(true);
    await submit({ ...body, message: `${body.message} Changed.` }).expect(409);
    const c = await db.query("SELECT count(*)::int AS n FROM customer_feedback WHERE display_name = $1", [
      body.name,
    ]);
    expect(c.rows[0].n).toBe(1);
  });

  it("rate-limits repeated submissions from one client", async () => {
    const from = nextIp();
    for (let i = 0; i < 4; i++) await submit(base(), from).expect(201);
    await submit(base(), from).expect(429);
  });

  it("blocks anonymous access to every staff route", async () => {
    const id = randomUUID();
    await http.get("/api/v1/admin/feedback").expect(401);
    await http.get(`/api/v1/admin/feedback/${id}`).expect(401);
    for (const a of ["approve", "reject", "hide", "restore"]) {
      await http.post(`/api/v1/admin/feedback/${id}/${a}`).send({}).expect(401);
    }
  });

  it("moderates: approve → public, hide → removed, restore (admin only) → public again", async () => {
    const body = base();
    await submit(body).expect(201);
    const id = await idOf(body.name);

    await http.post(`/api/v1/admin/feedback/${id}/approve`).set(editor).send({}).expect(200);
    const pub = (await http.get("/api/v1/feedback").expect(200)).body.items.find(
      (i: { name: string }) => i.name === body.name,
    );
    expect(pub).toBeDefined();
    expect(Object.keys(pub).sort()).toEqual([
      "id",
      "language",
      "location",
      "message",
      "month",
      "name",
      "rating",
    ]);

    await http.post(`/api/v1/admin/feedback/${id}/hide`).set(editor).send({ note: "Test note" }).expect(200);
    expect(await publicNames()).not.toContain(body.name);

    await http.post(`/api/v1/admin/feedback/${id}/restore`).set(editor).send({}).expect(403);
    await http.post(`/api/v1/admin/feedback/${id}/restore`).set(admin).send({}).expect(200);
    expect(await publicNames()).toContain(body.name);

    const audit = await db.query("SELECT action FROM audit_log WHERE entity_id = $1 ORDER BY id", [id]);
    expect(audit.rows.map((r) => r.action)).toEqual([
      "feedback.approve",
      "feedback.hide",
      "feedback.restore",
    ]);
  });

  it("rejected feedback never becomes public and cannot be approved afterwards", async () => {
    const body = base();
    await submit(body).expect(201);
    const id = await idOf(body.name);
    await http.post(`/api/v1/admin/feedback/${id}/reject`).set(editor).send({ note: "Test" }).expect(200);
    expect(await publicNames()).not.toContain(body.name);
    await http.post(`/api/v1/admin/feedback/${id}/approve`).set(admin).send({}).expect(409);
    await http.post(`/api/v1/admin/feedback/${id}/hide`).set(admin).send({}).expect(409);
    expect(await publicNames()).not.toContain(body.name);
  });

  it("lists with status filters and counts for staff", async () => {
    const res = await http.get("/api/v1/admin/feedback?status=pending").set(editor).expect(200);
    expect(res.body.items.every((i: { status: string }) => i.status === "pending")).toBe(true);
    expect(res.body.statusCounts.pending).toBeGreaterThan(0);
    expect(Object.keys(res.body.statusCounts).sort()).toEqual(["approved", "hidden", "pending", "rejected"]);
    await http.get("/api/v1/admin/feedback?status=published").set(editor).expect(400);
    await http.get(`/api/v1/admin/feedback/${randomUUID()}`).set(editor).expect(404);
  });

  it("dashboard reports the pending count", async () => {
    const res = await http.get("/api/v1/admin/dashboard").set(editor).expect(200);
    expect(res.body.counts.pendingFeedback).toBeGreaterThan(0);
  });
});
