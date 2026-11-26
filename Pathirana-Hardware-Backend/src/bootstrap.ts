import { type INestApplication, ValidationPipe, VersioningType } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { JwtService } from "@nestjs/jwt";
import helmet from "helmet";
import { clientIdentity } from "./common/client-identity";
import type { Env } from "./config/env";
import { bodyParserErrors, HttpExceptionFilter } from "./common/http-exception.filter";
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
  // Request ID first, so body errors (invalid / too large JSON) are logged and answered with it too.
  app.use(requestContext);
  express.useBodyParser("json", { limit: "100kb" });
  app.use(bodyParserErrors);
  // Client identity for rate limits / sign-in failure counting (see common/client-identity.ts).
  const jwt = app.get(JwtService);
  app.use(
    clientIdentity(env.ADMIN_CLIENT_SECRET, (token) => {
      try {
        return jwt.verify<{ sub?: unknown }>(token);
      } catch {
        return null;
      }
    }),
  );
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
