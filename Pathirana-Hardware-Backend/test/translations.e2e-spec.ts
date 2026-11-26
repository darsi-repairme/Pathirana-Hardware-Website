import type { INestApplication } from "@nestjs/common";
import type { Client } from "pg";
import request from "supertest";
import { createStaff, createTestApp, login } from "./helpers";

/**
 * Staff-entered Tamil / Sinhala catalogue text (migration 0006). Isolated
 * throwaway database; the "translations" below are test strings only.
 */
const EDITOR = { email: "tr-editor@test.invalid", password: "Translations-Editor-Password-1" };

describe("Content translations", () => {
  let app: INestApplication;
  let db: Client;
  let http: ReturnType<typeof request>;
  let auth: { Authorization: string };
  let categoryId: string;
  let productId: string;

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

  it("existing English-only records keep working with an empty translations object", async () => {
    const c = await http.post("/api/v1/admin/categories").set(auth).send({ name: "Test Cement" }).expect(201);
    categoryId = c.body.id;
    expect(c.body.translations).toEqual({});
    const p = await http
      .post("/api/v1/admin/products")
      .set(auth)
      .send({ name: "Test Portland Cement", categoryId, summary: "English summary" })
      .expect(201);
    productId = p.body.id;
    expect(p.body.translations).toEqual({});
  });

  it("stores cleaned translations for a category and a product", async () => {
    const c = await http
      .patch(`/api/v1/admin/categories/${categoryId}`)
      .set(auth)
      .send({ translations: { ta: { name: "  சோதனை  சீமெந்து " }, si: { name: "", description: "" } } })
      .expect(200);
    expect(c.body.translations).toEqual({ ta: { name: "சோதனை சீமெந்து" } });

    const p = await http
      .patch(`/api/v1/admin/products/${productId}`)
      .set(auth)
      .send({
        translations: {
          ta: { name: "சோதனை சீமெந்து", summary: "தமிழ் சுருக்கம்", searchTerms: ["சீமெந்து", "சீமெந்து", " "] },
          si: { name: "පරීක්ෂණ සිමෙන්ති", description: "පළමු පේළිය\n\n\n\nදෙවන පේළිය" },
        },
      })
      .expect(200);
    expect(p.body.translations).toEqual({
      ta: { name: "சோதனை சீமெந்து", summary: "தமிழ் சுருக்கம்", searchTerms: ["சீமெந்து"] },
      si: { name: "පරීක්ෂණ සිමෙන්ති", description: "පළමු පේළිය\n\nදෙවන පේළිය" },
    });
    // English and pricing are untouched.
    expect(p.body.name).toBe("Test Portland Cement");
    expect(p.body.contactForPrice).toBe(true);
  });

  it("rejects unknown locales, unknown fields and over-long text", async () => {
    const send = (translations: unknown) =>
      http.patch(`/api/v1/admin/products/${productId}`).set(auth).send({ translations });
    await send({ fr: { name: "x" } }).expect(400);
    await send({ ta: { price: "1" } }).expect(400);
    await send({ ta: { name: "x".repeat(161) } }).expect(400);
    await send({ ta: "not an object" }).expect(400);
  });

  it("public API exposes name/summary/description translations but not search keywords", async () => {
    await http
      .patch(`/api/v1/admin/products/${productId}/publication`)
      .set(auth)
      .send({ published: true })
      .expect(200);
    const list = await http.get("/api/v1/products").expect(200);
    const item = list.body.items.find((i: { slug: string }) => i.slug === "test-portland-cement");
    expect(item.translations).toEqual({
      ta: { name: "சோதனை சீமெந்து", summary: "தமிழ் சுருக்கம்" },
      si: { name: "පරීක්ෂණ සිමෙන්ති" },
    });
    expect(item.category.translations).toEqual({ ta: { name: "சோதனை சீமெந்து" } });
    const detail = await http.get("/api/v1/products/test-portland-cement").expect(200);
    expect(detail.body.translations.si.description).toBe("පළමු පේළිය\n\nදෙවන පේළිය");
    expect(JSON.stringify(detail.body)).not.toContain("searchTerms");
    const cats = await http.get("/api/v1/categories").expect(200);
    expect(cats.body.items[0].translations).toEqual({ ta: { name: "சோதனை சீமெந்து" } });
  });

  it("search matches translated names and keywords", async () => {
    for (const q of ["සිමෙන්ති", "சீமெந்து"]) {
      const res = await http.get(`/api/v1/products?q=${encodeURIComponent(q)}`).expect(200);
      expect(res.body.items.map((i: { slug: string }) => i.slug)).toContain("test-portland-cement");
    }
  });

  it("delivery areas: translated names are public and accepted by the area check", async () => {
    await http
      .post("/api/v1/admin/delivery-areas")
      .set(auth)
      .send({
        name: "Test Area",
        translations: { ta: { name: "சோதனைப் பகுதி" }, si: { name: "පරීක්ෂණ ප්‍රදේශය" } },
      })
      .expect(201);
    const list = await http.get("/api/v1/delivery-areas").expect(200);
    expect(list.body.items[0].translations.ta.name).toBe("சோதனைப் பகுதி");
    const check = await http
      .get(`/api/v1/delivery-areas/check?area=${encodeURIComponent("சோதனைப் பகுதி")}`)
      .expect(200);
    expect(check.body.supported).toBe(true);
    expect(check.body.area.name).toBe("Test Area");
  });

  it("clearing translations removes them", async () => {
    const p = await http
      .patch(`/api/v1/admin/products/${productId}`)
      .set(auth)
      .send({ translations: {} })
      .expect(200);
    expect(p.body.translations).toEqual({});
  });
});
