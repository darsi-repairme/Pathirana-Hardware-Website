import { type DynamicModule, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module";
import { CatalogueModule } from "./catalogue/catalogue.module";
import { ENV, type Env } from "./config/env";
import { DatabaseModule } from "./database/database.module";
import { DeliveryAreasModule } from "./delivery-areas/delivery-areas";
import { HealthController } from "./health/health.controller";
import { QuotationsModule } from "./quotations/quotations";
import { DashboardController } from "./staff/dashboard.controller";
import { StaffController } from "./staff/staff.controller";

@Module({})
export class AppModule {
  /** The validated environment is injected once (no direct process.env reads elsewhere). */
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppModule,
      global: true,
      imports: [
        // Default: 120 requests per minute per client; login has its own stricter limit.
        ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 120 }]),
        DatabaseModule,
        AuthModule,
        CatalogueModule,
        DeliveryAreasModule,
        QuotationsModule,
      ],
      controllers: [HealthController, StaffController, DashboardController],
      providers: [
        { provide: ENV, useValue: env },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
      exports: [ENV],
    };
  }
}
