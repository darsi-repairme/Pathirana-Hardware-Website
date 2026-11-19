import "reflect-metadata";
import { existsSync } from "node:fs";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { configureApp } from "./bootstrap";
import { loadEnv } from "./config/env";
import { DatabaseService } from "./database/database.service";
import { pendingMigrations } from "./database/migrator";

const LEVELS = ["error", "warn", "log", "debug", "verbose"] as const;

async function main() {
  if (existsSync(".env")) process.loadEnvFile(".env");
  const env = loadEnv(); // throws (without printing values) when configuration is unsafe
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(env), {
    logger: LEVELS.slice(0, LEVELS.indexOf(env.LOG_LEVEL) + 1),
    bodyParser: false,
  });
  configureApp(app, env);
  // Never serve with a schema older than the code (e.g. new build, migration not yet applied).
  const client = await app.get(DatabaseService).pool.connect();
  try {
    const pending = await pendingMigrations(client);
    if (pending.length) {
      throw new Error(
        `Database migrations pending (${pending.join(", ")}). Back up the database, then run: ` +
          "npm run db:migrate -- --apply --confirm-database=<name>",
      );
    }
  } finally {
    client.release();
  }
  await app.listen(env.PORT);
  new Logger("Bootstrap").log(`API listening on port ${env.PORT} (${env.NODE_ENV})`);
}

main().catch((e: Error) => {
  // Message only — never the full environment.
  console.error(e.message);
  process.exit(1);
});
