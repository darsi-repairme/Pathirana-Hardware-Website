import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

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
