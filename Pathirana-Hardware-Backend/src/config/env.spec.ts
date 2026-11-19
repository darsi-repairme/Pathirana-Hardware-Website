import { loadEnv } from "./env";

const base = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  JWT_SECRET: "x".repeat(32),
};

describe("loadEnv", () => {
  it("applies safe defaults", () => {
    const env = loadEnv(base);
    expect(env.PORT).toBe(4000);
    expect(env.JWT_EXPIRES_IN).toBe("8h");
    expect(env.CORS_ORIGINS).toEqual([]);
  });

  it("rejects a short JWT secret without echoing it", () => {
    let message = "";
    try {
      loadEnv({ ...base, JWT_SECRET: "short-secret-value" });
    } catch (e) {
      message = String(e);
    }
    expect(message).toMatch(/JWT_SECRET/);
    expect(message).not.toContain("short-secret-value");
  });

  it("requires a postgres URL", () => {
    expect(() => loadEnv({ ...base, DATABASE_URL: "mysql://x" })).toThrow(/DATABASE_URL/);
  });

  it("parses CORS origins and rejects paths", () => {
    expect(loadEnv({ ...base, CORS_ORIGINS: "https://a.lk, http://localhost:3000" }).CORS_ORIGINS).toEqual([
      "https://a.lk",
      "http://localhost:3000",
    ]);
    expect(() => loadEnv({ ...base, CORS_ORIGINS: "https://a.lk/path" })).toThrow(/CORS_ORIGINS/);
  });

  it("requires CORS origins in production", () => {
    expect(() => loadEnv({ ...base, NODE_ENV: "production" })).toThrow(/CORS_ORIGINS/);
  });
});
