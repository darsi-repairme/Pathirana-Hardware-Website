import type { INestApplication } from "@nestjs/common";
import type { Client } from "pg";
import sharp from "sharp";
import request from "supertest";
import { createStaff, createTestApp, login } from "./helpers";

const image = (w: number, h: number, format: "png" | "jpeg" = "png") => {
  const s = sharp({ create: { width: w, height: h, channels: 3, background: { r: 20, g: 120, b: 60 } } });
  return (format === "png" ? s.png() : s.jpeg()).toBuffer();
};

describe("Staff profile photos", () => {
  let app: INestApplication;
  let db: Client;
  let http: ReturnType<typeof request>;
  let admin: string;
  let editor: string;
  let other: string;
  let editorId: string;
  let otherId: string;
  const bin = (r: request.Test) =>
    r.buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => cb(null, Buffer.concat(chunks)));
    });

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    http = request(app.getHttpServer());
    await createStaff(db, "owner@photo.test", "admin", "Owner-Photo-Password-1");
    await createStaff(db, "editor@photo.test", "editor", "Editor-Photo-Password-1");
    await createStaff(db, "other@photo.test", "editor", "Other-Photo-Password-1");
    const ids = await db.query<{ id: string; email: string }>("SELECT id, email FROM staff");
    editorId = ids.rows.find((r) => r.email === "editor@photo.test")!.id;
    otherId = ids.rows.find((r) => r.email === "other@photo.test")!.id;
    admin = await login(app, "owner@photo.test", "Owner-Photo-Password-1");
    editor = await login(app, "editor@photo.test", "Editor-Photo-Password-1");
    other = await login(app, "other@photo.test", "Other-Photo-Password-1");
  });
  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it("requires sign-in for every route", async () => {
    await http.get("/api/v1/admin/profile/photo/info").expect(401);
    await http
      .put("/api/v1/admin/profile/photo")
      .attach("file", await image(200, 200), "a.png")
      .expect(401);
    await http.get(`/api/v1/admin/staff/${editorId}/photo`).expect(401);
  });

  it("starts with no photo", async () => {
    const r = await http
      .get("/api/v1/admin/profile/photo/info")
      .set("Authorization", `Bearer ${editor}`)
      .expect(200);
    expect(r.body).toEqual({ photoVersion: null });
    await http.get("/api/v1/admin/profile/photo").set("Authorization", `Bearer ${editor}`).expect(404);
  });

  it("rejects non-images, wrong types, tiny and oversized images", async () => {
    const put = () => http.put("/api/v1/admin/profile/photo").set("Authorization", `Bearer ${editor}`);
    await put().expect(400); // no file
    await put()
      .attach("file", Buffer.from("not an image"), { filename: "x.png", contentType: "image/png" })
      .expect(415);
    await put()
      .attach("file", Buffer.from("GIF89a"), { filename: "x.gif", contentType: "image/gif" })
      .expect(415);
    const tiny = await put()
      .attach("file", await image(60, 60), "tiny.png")
      .expect(400);
    expect(String(tiny.body.message)).toContain("at least 96");
    const big = Buffer.concat([await image(200, 200, "jpeg"), Buffer.alloc(2.2 * 1024 * 1024)]);
    await put().attach("file", big, { filename: "big.jpg", contentType: "image/jpeg" }).expect(413);
    const n = await db.query("SELECT photo_key FROM staff WHERE id = $1", [editorId]);
    expect(n.rows[0].photo_key).toBeNull();
  });

  it("uploads, serves (square WebP, private cache), replaces and removes the OWN photo", async () => {
    const up = await http
      .put("/api/v1/admin/profile/photo")
      .set("Authorization", `Bearer ${editor}`)
      .attach("file", await image(900, 600, "jpeg"), "me.jpg")
      .expect(200);
    expect(up.body.photoVersion).toMatch(/^\d+$/);
    const first = (await db.query("SELECT photo_key FROM staff WHERE id = $1", [editorId])).rows[0].photo_key;
    expect(first).toMatch(/^[0-9a-f-]{36}$/);

    const served = await bin(
      http.get("/api/v1/admin/profile/photo").set("Authorization", `Bearer ${editor}`),
    ).expect(200);
    expect(served.headers["content-type"]).toBe("image/webp");
    expect(served.headers["cache-control"]).toBe("private, max-age=86400");
    const meta = await sharp(served.body as Buffer).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 512, 512]);
    const thumb = await bin(
      http
        .get(`/api/v1/admin/profile/photo?v=${up.body.photoVersion}&size=thumb`)
        .set("Authorization", `Bearer ${editor}`),
    ).expect(200);
    expect((await sharp(thumb.body as Buffer).metadata()).width).toBe(128);

    // Visible in the info endpoint and the admin Staff list, persists across sign-in.
    const again = await login(app, "editor@photo.test", "Editor-Photo-Password-1");
    const info = await http
      .get("/api/v1/admin/profile/photo/info")
      .set("Authorization", `Bearer ${again}`)
      .expect(200);
    expect(info.body.photoVersion).toBe(up.body.photoVersion);
    const list = await http.get("/api/v1/admin/staff").set("Authorization", `Bearer ${admin}`).expect(200);
    const row = (list.body.items ?? list.body).find((s: { id: string }) => s.id === editorId);
    expect(row.photoVersion).toBe(up.body.photoVersion);

    // Replace: new key, new version.
    const rep = await http
      .put("/api/v1/admin/profile/photo")
      .set("Authorization", `Bearer ${again}`)
      .attach("file", await image(300, 300), "me2.png")
      .expect(200);
    expect(rep.body.photoVersion).not.toBe(up.body.photoVersion);
    const second = (await db.query("SELECT photo_key FROM staff WHERE id = $1", [editorId])).rows[0]
      .photo_key;
    expect(second).not.toBe(first);

    // Remove.
    await http.delete("/api/v1/admin/profile/photo").set("Authorization", `Bearer ${again}`).expect(204);
    await http.delete("/api/v1/admin/profile/photo").set("Authorization", `Bearer ${again}`).expect(204); // idempotent
    expect(
      (await db.query("SELECT photo_key FROM staff WHERE id = $1", [editorId])).rows[0].photo_key,
    ).toBeNull();
    await http.get("/api/v1/admin/profile/photo").set("Authorization", `Bearer ${again}`).expect(404);

    const audit = await db.query<{ action: string }>(
      "SELECT action FROM audit_log WHERE entity_id = $1 AND action LIKE 'staff.photo.%' ORDER BY created_at",
      [editorId],
    );
    expect(audit.rows.map((r) => r.action)).toEqual([
      "staff.photo.add",
      "staff.photo.replace",
      "staff.photo.remove",
    ]);
  });

  it("editors cannot view or change another person's photo; admins can", async () => {
    await http
      .put("/api/v1/admin/profile/photo")
      .set("Authorization", `Bearer ${other}`)
      .attach("file", await image(200, 200), "o.png")
      .expect(200);
    await http
      .get(`/api/v1/admin/staff/${otherId}/photo`)
      .set("Authorization", `Bearer ${editor}`)
      .expect(403);
    await http
      .put(`/api/v1/admin/staff/${otherId}/photo`)
      .set("Authorization", `Bearer ${editor}`)
      .attach("file", await image(200, 200), "x.png")
      .expect(403);
    await http
      .delete(`/api/v1/admin/staff/${otherId}/photo`)
      .set("Authorization", `Bearer ${editor}`)
      .expect(403);
    // The owner can see their own through either route.
    await http
      .get(`/api/v1/admin/staff/${otherId}/photo`)
      .set("Authorization", `Bearer ${other}`)
      .expect(200);
    // Admin can view, replace and remove.
    await http
      .get(`/api/v1/admin/staff/${otherId}/photo`)
      .set("Authorization", `Bearer ${admin}`)
      .expect(200);
    await http
      .put(`/api/v1/admin/staff/${otherId}/photo`)
      .set("Authorization", `Bearer ${admin}`)
      .attach("file", await image(150, 150), "a.png")
      .expect(200);
    await http
      .delete(`/api/v1/admin/staff/${otherId}/photo`)
      .set("Authorization", `Bearer ${admin}`)
      .expect(204);
    const audit = await db.query<{ details: { byAdmin?: boolean } }>(
      "SELECT details FROM audit_log WHERE entity_id = $1 AND action = 'staff.photo.remove'",
      [otherId],
    );
    expect(audit.rows[0]!.details.byAdmin).toBe(true);
    // Role and other fields are untouched by photo changes.
    const r = await db.query("SELECT role, is_active FROM staff WHERE id = $1", [otherId]);
    expect(r.rows[0]).toEqual({ role: "editor", is_active: true });
  });
});
