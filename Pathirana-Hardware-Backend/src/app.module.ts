import { type DynamicModule, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module";
import { isSignInSourceLimited, SIGN_IN_SOURCE_THROTTLER } from "./auth/sign-in-limits";
import { requestTracker } from "./common/client-identity";
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
        // Default: 120 requests per minute per signed-in staff member, otherwise per client
        // (common/client-identity.ts); login has its own stricter limits (auth.controller.ts).
        ThrottlerModule.forRoot([
          { name: "default", ttl: 60_000, limit: 120, getTracker: requestTracker },
          // Total sign-in attempts per client source (all emails). Only on routes marked @SignInSourceLimit().
          {
            name: SIGN_IN_SOURCE_THROTTLER,
            ttl: 60_000,
            limit: 60,
            getTracker: requestTracker,
            skipIf: (ctx) => !isSignInSourceLimited(ctx),
          },
        ]),
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
