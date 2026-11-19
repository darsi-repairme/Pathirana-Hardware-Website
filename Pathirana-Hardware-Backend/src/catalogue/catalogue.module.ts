import { Module, UnsupportedMediaTypeException } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { ENV, type Env } from "../config/env";
import {
  AdminBrandsController,
  BrandsService,
  PublicBrandLogosController,
  PublicBrandsController,
} from "./brands";
import {
  AdminCategoriesController,
  CategoriesService,
  PublicCategoriesController,
  PublicCategoryImagesController,
} from "./categories";
import { CatalogueMediaService } from "./media.service";
import { ALLOWED_UPLOAD_TYPES, ProductImagesService } from "./images.service";
import {
  AdminProductsController,
  PublicProductImagesController,
  PublicProductsController,
} from "./products.controller";
import { ProductsService } from "./products.service";

@Module({
  imports: [
    // Uploads are held in memory (bounded by the size limit), validated and
    // re-encoded before anything is written to disk.
    MulterModule.registerAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        storage: memoryStorage(),
        limits: { fileSize: Math.round(env.MAX_UPLOAD_MB * 1024 * 1024), files: 1, fields: 5, parts: 7 },
        fileFilter: (_req, file, cb) =>
          (ALLOWED_UPLOAD_TYPES as readonly string[]).includes(file.mimetype)
            ? cb(null, true)
            : cb(new UnsupportedMediaTypeException("Only JPEG, PNG or WebP images are accepted."), false),
      }),
    }),
  ],
  controllers: [
    PublicCategoriesController,
    AdminCategoriesController,
    PublicCategoryImagesController,
    PublicBrandsController,
    PublicBrandLogosController,
    AdminBrandsController,
    PublicProductsController,
    PublicProductImagesController,
    AdminProductsController,
  ],
  providers: [CategoriesService, BrandsService, ProductsService, ProductImagesService, CatalogueMediaService],
})
export class CatalogueModule {}
