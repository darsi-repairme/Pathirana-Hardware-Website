import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

type PgError = { code?: string; constraint?: string };

/** Postgres error codes that are the client's fault, mapped to safe messages. */
const PG_ERRORS: Record<string, [number, string]> = {
  "23505": [HttpStatus.CONFLICT, "A record with these details already exists."],
  "23503": [HttpStatus.CONFLICT, "This record is linked to other records."],
  "23514": [HttpStatus.BAD_REQUEST, "One or more values are not allowed."],
  "23502": [HttpStatus.BAD_REQUEST, "A required value is missing."],
  "22P02": [HttpStatus.BAD_REQUEST, "Invalid input."],
  "22001": [HttpStatus.BAD_REQUEST, "A value is too long."],
};

/**
 * Unique constraints → which value is already taken (audit ADM-2). Only the message is sent, never
 * the constraint name. Other duplicates keep the generic "already exists" message.
 */
const DUPLICATES: Record<string, string> = {
  categories_name_key: "A category with this name already exists.",
  // A slug left empty is made from the name, so a repeated name usually shows up as a slug clash.
  categories_slug_key: "A category with this name or URL slug already exists.",
  brands_name_key: "A brand with this name already exists.",
  brands_slug_key: "A brand with this name or URL slug already exists.",
  products_slug_key:
    "Another product already uses this URL slug (made from the name when left empty). Change the name or the URL slug.",
  delivery_areas_name_key: "A delivery area with this name already exists.",
  offers_promo_code_key: "Another offer already uses this promo code.",
  services_slug_key: "Another service already uses this URL slug.",
  staff_email_key: "A staff account with this email already exists.",
};

/** Request-body errors from the JSON body parser (by its `type`), mapped to safe messages. */
const BODY_ERRORS: Record<string, [number, string]> = {
  "entity.parse.failed": [HttpStatus.BAD_REQUEST, "The request body is not valid JSON."],
  "entity.too.large": [HttpStatus.PAYLOAD_TOO_LARGE, "The request body is too large."],
  "request.size.invalid": [HttpStatus.BAD_REQUEST, "The request body is incomplete."],
  "request.aborted": [HttpStatus.BAD_REQUEST, "The request body is incomplete."],
  "encoding.unsupported": [HttpStatus.UNSUPPORTED_MEDIA_TYPE, "This request body encoding is not supported."],
  "charset.unsupported": [HttpStatus.UNSUPPORTED_MEDIA_TYPE, "This request body charset is not supported."],
};

/**
 * Express error middleware placed right after the body parser: its errors become HttpExceptions
 * with the safe messages above, so an oversized body is a 413 (not a 500) and invalid JSON never
 * echoes the parser's message (which can quote part of the body).
 */
export function bodyParserErrors(err: unknown, _req: Request, _res: Response, next: NextFunction) {
  const known = BODY_ERRORS[(err as { type?: unknown })?.type as string];
  next(known ? new HttpException(known[1], known[0]) : err);
}

/**
 * One response shape for every error:
 *   { statusCode, error, message, requestId, path, timestamp }
 * Unexpected errors are logged (with the request ID) and returned as a generic
 * 500 so internal details, SQL or stack traces never reach the client.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("Errors");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { id?: string }>();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = "Internal server error.";

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      message =
        typeof body === "string"
          ? body
          : ((body as { message?: string | string[] }).message ?? exception.message);
    } else if ((exception as PgError)?.code && PG_ERRORS[(exception as PgError).code!]) {
      [status, message] = PG_ERRORS[(exception as PgError).code!]!;
      const pg = exception as PgError;
      if (pg.code === "23505" && pg.constraint && DUPLICATES[pg.constraint])
        message = DUPLICATES[pg.constraint]!;
    } else {
      const e = exception as Error;
      this.logger.error(`[${req.id}] ${req.method} ${req.path}: ${e?.name}: ${e?.message}`, e?.stack);
    }

    const send = () => {
      if (res.headersSent) return;
      res.status(status).json({
        statusCode: status,
        error: HttpStatus[status] ?? "Error",
        message,
        requestId: req.id,
        path: req.path,
        timestamp: new Date().toISOString(),
      });
    };

    // Rejected before the body was read (e.g. an unauthenticated or oversized
    // upload): answering mid-upload makes the client see a connection reset, so
    // discard the rest of the body and reply when it ends. A body still arriving
    // after 5 s gets the reply with the connection closed.
    if (!req.complete && !req.destroyed) {
      const timer = setTimeout(() => {
        res.setHeader("Connection", "close");
        send();
      }, 5000);
      const done = () => {
        clearTimeout(timer);
        send();
      };
      req.once("end", done);
      req.once("error", done);
      req.resume();
      return;
    }
    send();
  }
}
