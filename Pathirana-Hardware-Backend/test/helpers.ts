import "reflect-metadata";
import { randomBytes } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModuleBuilder } from "@nestjs/testing";
import { Client } from "pg";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { hashPassword } from "../src/auth/password";
import { configureApp } from "../src/bootstrap";
import { loadEnv } from "../src/config/env";
import { applyMigrations } from "../src/database/migrator";

export const ORIGIN = "https://site.test";

/** A fresh database per test file (inside the throwaway cluster), so files never see each other's data. */
async function freshDatabase(): Promise<string> {
  const base = process.env.DATABASE_URL!;
  const name = `t_${randomBytes(6).toString("hex")}`;
  const admin = new Client({ connectionString: base });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name} TEMPLATE template0 ENCODING 'UTF8'`);
  await admin.end();
  const url = new URL(base);
  url.pathname = `/${name}`;
  return url.toString();
}

/** Nest app wired exactly like production, against its own isolated test database. */
export async function createTestApp(
  overrides: Record<string, string> = {},
  /** Optional provider overrides, e.g. a test double for the email provider. */
  customize: (builder: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
): Promise<{ app: INestApplication; db: Client }> {
  const databaseUrl = await freshDatabase();
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  await applyMigrations(db);
  const env = loadEnv({
    NODE_ENV: "test",
    DATABASE_URL: databaseUrl,
    JWT_SECRET: "integration-test-secret-0123456789abcdef",
    JWT_EXPIRES_IN: "15m",
    CORS_ORIGINS: ORIGIN,
    UPLOAD_DIR: process.env.TEST_UPLOAD_DIR,
    MAX_UPLOAD_MB: "1",
    LOG_LEVEL: "error",
    ...overrides,
  });
  const moduleRef = await customize(
    Test.createTestingModule({ imports: [AppModule.forRoot(env)] }),
  ).compile();
  const app = moduleRef.createNestApplication({ bodyParser: false, logger: ["error"] });
  configureApp(app, env);
  // Listen once (supertest otherwise opens and closes a server per request).
  await app.listen(0, "127.0.0.1");
  return { app, db };
}

/** Test-only staff account in the isolated database. */
export async function createStaff(db: Client, email: string, role: "admin" | "editor", password: string) {
  await db.query("INSERT INTO staff (email, full_name, role, password_hash) VALUES ($1, $2, $3, $4)", [
    email,
    `Test ${role}`,
    role,
    await hashPassword(password),
  ]);
}

export async function login(app: INestApplication, email: string, password: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email, password })
    .expect(200);
  return res.body.accessToken as string;
}
