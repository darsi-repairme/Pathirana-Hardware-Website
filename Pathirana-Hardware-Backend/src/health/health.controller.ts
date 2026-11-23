import { Controller, Get, Res, VERSION_NEUTRAL } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import type { Response } from "express";
import { DatabaseService } from "../database/database.service";

/** GET /api/health — liveness plus database reachability (no versions or internals exposed). */
@Controller({ path: "health", version: VERSION_NEUTRAL })
@SkipThrottle()
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  async health(@Res({ passthrough: true }) res: Response) {
    const database = (await this.db.ping()) ? "up" : "down";
    res.setHeader("Cache-Control", "no-store");
    if (database === "down") res.status(503);
    return { status: database === "up" ? "ok" : "degraded", database };
  }
}
