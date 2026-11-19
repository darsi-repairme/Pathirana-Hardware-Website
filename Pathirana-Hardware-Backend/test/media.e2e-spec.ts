import type { INestApplication } from "@nestjs/common";
import type { Client } from "pg";
import sharp from "sharp";
import request from "supertest";
import { createStaff, createTestApp, login } from "./helpers";

/**
 * Brand logos and category images (migration 0003): staff upload / replace /
 * remove; the public lists and files follow add, edit, activate and
 * deactivate. Isolated throwaway database — every record here is TEST data.
 */
const EDITOR = { email: "media-editor@test.invalid", password: "Media-Editor-Password-9" };

describe("Brand logos and category images", () => {
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

  const publicBrands = async () => (await http.get("/api/v1/brands").expect(200)).body.items;
  const publicCategories = async () => (await http.get("/api/v1/categories").expect(200)).body.items;

  it("brand: add → public; logo upload keeps exact pixels and transparency; replace; remove; deactivate", async () => {
    const created = await http
      .post("/api/v1/admin/brands")
      .set(auth)
      .send({ name: "Test Brand Logo" })
      .expect(201);
    const id = created.body.id as string;
    expect(created.body).toMatchObject({ slug: "test-brand-logo", logoKey: null, isActive: true });
    expect(await publicBrands()).toEqual([{ slug: "test-brand-logo", name: "Test Brand Logo", logo: null }]);

    // A small transparent PNG "logo" (half transparent, half brand green).
    const raw = Buffer.alloc(40 * 20 * 4);
    for (let i = 0; i < 40 * 20; i++) {
      if (i % 40 >= 20) raw.set([15, 93, 58, 255], i * 4);
    }
    const png = await sharp(raw, { raw: { width: 40, height: 20, channels: 4 } })
      .png()
      .toBuffer();

    await http.post(`/api/v1/admin/brands/${id}/logo`).attach("file", png, "logo.png").expect(401);
    await http
      .post(`/api/v1/admin/brands/${id}/logo`)
      .set(auth)
      .attach("file", Buffer.from("not an image"), { filename: "x.png", contentType: "image/png" })
      .expect(415);
    const up = await http
      .post(`/api/v1/admin/brands/${id}/logo`)
      .set(auth)
      .attach("file", png, "logo.png")
      .expect(201);
    expect(up.body).toMatchObject({ logoWidth: 40, logoHeight: 20 });
    const firstKey = up.body.logoKey as string;

    const [brand] = await publicBrands();
    expect(brand.logo).toEqual({ url: `/api/v1/brand-logos/${firstKey}`, width: 40, height: 20 });
    const served = await http.get(brand.logo.url).buffer(true).expect(200);
    expect(served.headers["content-type"]).toBe("image/webp");
    expect(served.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    // Lossless: identical pixels, transparency kept (no re-colouring of the original logo).
    const decoded = await sharp(served.body as Buffer)
      .ensureAlpha()
      .raw()
      .toBuffer();
    expect(decoded.equals(raw)).toBe(true);

    // Staff preview works; replacing gives a new URL and the old file is gone.
    await http.get(`/api/v1/admin/brands/${id}/logo`).set(auth).expect(200);
    const replaced = await http
      .post(`/api/v1/admin/brands/${id}/logo`)
      .set(auth)
      .attach("file", png, "logo2.png")
      .expect(201);
    expect(replaced.body.logoKey).not.toBe(firstKey);
    await http.get(`/api/v1/brand-logos/${firstKey}`).expect(404);
    await http.get(`/api/v1/brand-logos/${replaced.body.logoKey}`).expect(200);

    // Edit the name → public list follows.
    await http.patch(`/api/v1/admin/brands/${id}`).set(auth).send({ name: "Test Brand Renamed" }).expect(200);
    expect((await publicBrands())[0].name).toBe("Test Brand Renamed");

    // Deactivate → hidden from the list and its logo is no longer served.
    await http.patch(`/api/v1/admin/brands/${id}/status`).set(auth).send({ isActive: false }).expect(200);
    expect(await publicBrands()).toEqual([]);
    await http.get(`/api/v1/brand-logos/${replaced.body.logoKey}`).expect(404);
    await http.get(`/api/v1/admin/brands/${id}/logo`).set(auth).expect(200); // staff still see it
    await http.patch(`/api/v1/admin/brands/${id}/status`).set(auth).send({ isActive: true }).expect(200);

    // Remove → the brand shows its name only.
    await http.delete(`/api/v1/admin/brands/${id}/logo`).set(auth).expect(204);
    expect((await publicBrands())[0].logo).toBeNull();
    await http.get(`/api/v1/brand-logos/${replaced.body.logoKey}`).expect(404);
    await http.delete(`/api/v1/admin/brands/${id}/logo`).set(auth).expect(404);
    await http.get("/api/v1/brand-logos/not-a-key").expect(400);
  });

  it("category: add → public; image upload (full + thumb), alt text, replace, remove; deactivate hides it", async () => {
    const created = await http
      .post("/api/v1/admin/categories")
      .set(auth)
      .send({ name: "Test Category Image", description: "Test description." })
      .expect(201);
    const id = created.body.id as string;
    expect((await publicCategories()).map((c: { slug: string }) => c.slug)).toContain("test-category-image");
    expect((await publicCategories())[0].image).toBeNull();

    const jpg = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: "#b8860b" } })
      .jpeg()
      .toBuffer();
    await http
      .post(`/api/v1/admin/categories/${id}/image`)
      .set(auth)
      .attach("file", jpg, "c.jpg")
      .expect(400); // alt text required
    const up = await http
      .post(`/api/v1/admin/categories/${id}/image`)
      .set(auth)
      .attach("file", jpg, "c.jpg")
      .field("altText", "Test category photo")
      .expect(201);
    expect(up.body).toMatchObject({ imageWidth: 1600, imageHeight: 800, imageAlt: "Test category photo" });
    const key = up.body.imageKey as string;

    const [cat] = await publicCategories();
    expect(cat).toMatchObject({
      slug: "test-category-image",
      name: "Test Category Image",
      description: "Test description.",
      image: {
        url: `/api/v1/category-images/${key}`,
        thumbUrl: `/api/v1/category-images/${key}?size=thumb`,
        alt: "Test category photo",
        width: 1600,
        height: 800,
      },
    });
    const thumb = await http.get(cat.image.thumbUrl).buffer(true).expect(200);
    expect((await sharp(thumb.body as Buffer).metadata()).width).toBe(480);

    await http
      .patch(`/api/v1/admin/categories/${id}/image`)
      .set(auth)
      .send({ altText: "New alt" })
      .expect(200);
    expect((await publicCategories())[0].image.alt).toBe("New alt");
    await http
      .patch(`/api/v1/admin/categories/${id}`)
      .set(auth)
      .send({ name: "Test Category Edited" })
      .expect(200);
    expect((await publicCategories())[0].name).toBe("Test Category Edited");

    await http.patch(`/api/v1/admin/categories/${id}/status`).set(auth).send({ isActive: false }).expect(200);
    expect((await publicCategories()).map((c: { slug: string }) => c.slug)).not.toContain(
      "test-category-image",
    );
    await http.get(cat.image.url).expect(404);
    await http.patch(`/api/v1/admin/categories/${id}/status`).set(auth).send({ isActive: true }).expect(200);

    await http.delete(`/api/v1/admin/categories/${id}/image`).set(auth).expect(204);
    expect((await publicCategories())[0].image).toBeNull();
    await http.get(cat.image.url).expect(404);
    expect(
      (await db.query("SELECT count(*)::int AS n FROM audit_log WHERE action LIKE 'category.image.%'"))
        .rows[0].n,
    ).toBe(3);
  });
});
