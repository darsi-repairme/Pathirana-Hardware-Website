import { Module, UnsupportedMediaTypeException } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { ALLOWED_UPLOAD_TYPES } from "../catalogue/images.service";
import { ENV, type Env } from "../config/env";
import {
  AdminGalleryController,
  GalleryService,
  PublicGalleryController,
  PublicGalleryImagesController,
} from "./gallery";
import { AdminOffersController, OffersService, PublicOffersController } from "./offers";
import {
  AdminServicesController,
  PublicServiceImagesController,
  PublicServicesController,
  SiteServicesService,
} from "./services";

/** Website content managed in the Admin dashboard: Services, the photo Gallery (migration 0008) and Offers (0009). */
@Module({
  imports: [
    MulterModule.registerAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        storage: memoryStorage(),
        limits: { fileSize: Math.round(env.MAX_UPLOAD_MB * 1024 * 1024), files: 1, fields: 8, parts: 10 },
        fileFilter: (_req: unknown, file: Express.Multer.File, cb: (e: Error | null, ok: boolean) => void) =>
          (ALLOWED_UPLOAD_TYPES as readonly string[]).includes(file.mimetype)
            ? cb(null, true)
            : cb(new UnsupportedMediaTypeException("Only JPEG, PNG or WebP images are accepted."), false),
      }),
    }),
  ],
  controllers: [
    PublicServicesController,
    PublicServiceImagesController,
    AdminServicesController,
    PublicGalleryController,
    PublicGalleryImagesController,
    AdminGalleryController,
    PublicOffersController,
    AdminOffersController,
  ],
  providers: [SiteServicesService, GalleryService, OffersService],
  exports: [OffersService],
})
export class SiteModule {}
