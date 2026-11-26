import type { INestApplication } from "@nestjs/common";
import type { Client } from "pg";
import request from "supertest";
import { createTestApp } from "./helpers";

/**
 * Request bodies that are not acceptable JSON (isolated database; the bodies are rejected before
 * any handler runs, so nothing is written): malformed JSON → 400, a non-JSON Content-Type on a
 * JSON endpoint → 400 (validation; the body is never parsed), JSON over the 100 kB limit → 413.
 * Always the API's normal error shape with a request ID, never a 500 or a stack trace, and the
 * API stays healthy.
 */
describe("JSON request bodies", () => {
  let app: INestApplication;
  let db: Client;
  let http: ReturnType<typeof request>;
  const LOGIN = "/api/v1/auth/login";

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    http = request(app.getHttpServer());
  });
  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  const expectSafeError = (res: request.Response, status: number) => {
    expect(res.status).toBe(status);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toMatchObject({ statusCode: status, path: LOGIN });
    expect(typeof res.body.message).toBe("string");
    expect(res.body.requestId).toEqual(expect.any(String));
    expect(res.body.requestId).toBe(res.headers["x-request-id"]);
    expect(JSON.stringify(res.body)).not.toMatch(/at \w+ \(|node_modules|SyntaxError|stack/i);
  };
  const healthy = async () => expect((await http.get("/api/health")).status).toBe(200);

  it("malformed JSON → 400", async () => {
    const res = await http
      .post(LOGIN)
      .set("Content-Type", "application/json")
      .send('{"email": "a@test.invalid", "password": ');
    expectSafeError(res, 400);
    expect(res.body.message).toBe("The request body is not valid JSON.");
    await healthy();
  });

  it("a non-JSON Content-Type on a JSON endpoint → 400, the body is not used", async () => {
    const res = await http
      .post(LOGIN)
      .set("Content-Type", "text/plain")
      .send(JSON.stringify({ email: "a@test.invalid", password: "whatever-password" }));
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400, path: LOGIN });
    await healthy();
  });

  it("JSON larger than 100 kB → 413", async () => {
    const res = await http
      .post(LOGIN)
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ email: "a@test.invalid", password: "x", padding: "x".repeat(110_000) }));
    expectSafeError(res, 413);
    expect(res.body.message).toBe("The request body is too large.");
    await healthy();
  });
});
