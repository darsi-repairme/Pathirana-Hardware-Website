import { type DynamicModule, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module";
import { CatalogueModule } from "./catalogue/catalogue.module";
import { ENV, type Env } from "./config/env";
import { DatabaseModule } from "./database/database.module";
import { DeliveryAreasModule } from "./delivery-areas/delivery-areas";
import { FeedbackModule } from "./feedback/feedback";
import { HealthController } from "./health/health.controller";
import { SiteModule } from "./site/site.module";
import { MediaStorageModule } from "./media/media-storage";
import { QuotationsModule } from "./quotations/quotations";
import { AuditLogController, DashboardController } from "./staff/dashboard.controller";
import { PasswordSetupController, StaffController } from "./staff/staff.controller";
import { OwnerSetupController } from "./staff/owner-setup.controller";
import { ProfilePhotoModule } from "./staff/profile-photo";

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
        MediaStorageModule,
        AuthModule,
        CatalogueModule,
        DeliveryAreasModule,
        QuotationsModule,
        SiteModule,
        FeedbackModule,
        ProfilePhotoModule,
      ],
      controllers: [
        HealthController,
        StaffController,
        PasswordSetupController,
        OwnerSetupController,
        DashboardController,
        AuditLogController,
      ],
      providers: [
        { provide: ENV, useValue: env },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
      exports: [ENV],
    };
  }
}
