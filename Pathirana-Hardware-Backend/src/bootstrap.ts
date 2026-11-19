import { type INestApplication, ValidationPipe, VersioningType } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import type { Env } from "./config/env";
import { HttpExceptionFilter } from "./common/http-exception.filter";
import { requestContext } from "./common/request-context.middleware";

/**
 * Shared app configuration (used by main.ts and the integration tests):
 * /api prefix with URI versioning (/api/v1/...), security headers, restricted
 * CORS, global validation, one error format and graceful shutdown.
 */
export function configureApp(app: INestApplication, env: Env): INestApplication {
  const express = app as NestExpressApplication;
  express.disable("x-powered-by");
  if (env.TRUST_PROXY) express.set("trust proxy", 1);
  express.useBodyParser("json", { limit: "100kb" });

  app.use(requestContext);
  app.use(
    helmet({
      // JSON API: nothing to render, so lock the document policy right down.
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: "same-site" },
    }),
  );
  app.enableCors({
    origin: env.CORS_ORIGINS, // exact origins only; requests from anywhere else get no CORS headers
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Authorization", "Content-Type", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id"],
    credentials: false,
    maxAge: 600,
  });
  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: false,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
  return app;
}
