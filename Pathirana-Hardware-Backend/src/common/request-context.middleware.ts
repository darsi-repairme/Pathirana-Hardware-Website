import { randomUUID } from "node:crypto";
import { Logger } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

const logger = new Logger("HTTP");
const SAFE_ID = /^[A-Za-z0-9-]{8,64}$/;

/**
 * Assigns a request ID (echoed as X-Request-Id) and logs one line per request:
 * method, path, status and duration. Headers, bodies and query strings are
 * never logged (they can hold tokens, passwords or personal data).
 */
export function requestContext(req: Request & { id?: string }, res: Response, next: NextFunction) {
  const incoming = req.header("x-request-id");
  req.id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader("X-Request-Id", req.id);
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    logger.log(`${req.method} ${req.path} ${res.statusCode} ${ms.toFixed(1)}ms [${req.id}]`);
  });
  next();
}
