import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import type { AuthStaff } from "../auth/auth.service";
import { RequirePermission } from "../auth/roles";
import { CurrentStaff, StaffAuthGuard } from "../auth/staff-auth.guard";
import { ProductImagesService, type ImageSize } from "./images.service";
import {
  AdminProductQuery,
  CreateProductBody,
  PricingBody,
  ProductQuery,
  ProductsService,
  PublicationBody,
  UpdateProductBody,
} from "./products.service";

class ImageUploadBody {
  @IsString() @MinLength(1) @MaxLength(250) altText!: string;
  /** multipart text field: "true" makes the new image the main image. */
  @IsOptional() @IsIn(["true", "false"]) isMain?: "true" | "false";
}

class ImageUpdateBody {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(250) altText?: string;
  @IsOptional() @IsBoolean() isMain?: boolean;
}

class DeleteProductBody {
  /** Must equal the product's slug: an explicit confirmation of permanent deletion. */
  @IsString() @MinLength(1) @MaxLength(80) confirmSlug!: string;
}

class ImageQuery {
  @IsOptional() @IsIn(["full", "thumb"]) size?: ImageSize;
  /** Cache-buster the Admin adds when an image is replaced (?v=…); not used by the server. */
  @IsOptional() @IsString() @MaxLength(100) v?: string;
}

class SlugParam {
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/) @MaxLength(80) slug!: string;
}

/** Public catalogue: published products in active categories only. */
@Controller("products")
export class PublicProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Query() q: ProductQuery) {
    return this.products.listPublic(q);
  }

  @Get(":slug")
  get(@Param() p: SlugParam) {
    return this.products.getPublic(p.slug);
  }
}

@Controller("product-images")
export class PublicProductImagesController {
  constructor(private readonly images: ProductImagesService) {}

  @Get(":id")
  async get(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() q: ImageQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.images.publicFile(id, q.size ?? "full");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return new StreamableFile(file, { type: "image/webp" });
  }
}

@Controller("admin/products")
@UseGuards(StaffAuthGuard)
@RequirePermission("catalogue:write")
export class AdminProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly images: ProductImagesService,
  ) {}

  @Get()
  list(@Query() q: AdminProductQuery) {
    return this.products.listAll(q);
  }

  /**
   * The authoritative price calculation for unsaved form values (the admin
   * preview). Same function as the public API; returns problems, never saves.
   */
  @Post("price-preview")
  @HttpCode(200)
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  pricePreview(@Body() body: PricingBody) {
    return this.products.preview(body);
  }

  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.products.getAdmin(id);
  }

  @Post()
  create(@Body() body: CreateProductBody, @CurrentStaff() staff: AuthStaff) {
    return this.products.create(body, staff);
  }

  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateProductBody,
    @CurrentStaff() staff: AuthStaff,
  ) {
    return this.products.update(id, body, staff);
  }

  @Patch(":id/publication")
  publish(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: PublicationBody,
    @CurrentStaff() staff: AuthStaff,
  ) {
    return this.products.setPublished(id, body.published, staff);
  }

  /** PERMANENT deletion (admins only), confirmed with the product's slug. Unpublish is the routine action. */
  @Delete(":id")
  @RequirePermission("products:delete")
  remove(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: DeleteProductBody,
    @CurrentStaff() staff: AuthStaff,
  ) {
    return this.images.deleteProduct(id, body.confirmSlug, staff);
  }

  /** multipart/form-data: file (JPEG/PNG/WebP, size limit from MAX_UPLOAD_MB) + altText. */
  @Post(":id/images")
  @UseInterceptors(FileInterceptor("file"))
  upload(
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: ImageUploadBody,
    @CurrentStaff() staff: AuthStaff,
  ) {
    return this.images.upload(id, file, body.altText, staff, body.isMain === "true");
  }

  /** Edit alt text and/or make this the main image. */
  @Patch(":id/images/:imageId")
  updateImage(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("imageId", ParseUUIDPipe) imageId: string,
    @Body() body: ImageUpdateBody,
    @CurrentStaff() staff: AuthStaff,
  ) {
    return this.images.update(id, imageId, body, staff);
  }

  /** Staff preview of any image (also for unpublished products); never cached publicly. */
  @Get(":id/images/:imageId")
  async viewImage(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("imageId", ParseUUIDPipe) imageId: string,
    @Query() q: ImageQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.images.staffFile(id, imageId, q.size ?? "full");
    res.setHeader("Cache-Control", "private, no-store");
    return new StreamableFile(file, { type: "image/webp" });
  }

  @Delete(":id/images/:imageId")
  @HttpCode(204)
  async removeImage(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("imageId", ParseUUIDPipe) imageId: string,
    @CurrentStaff() staff: AuthStaff,
  ) {
    await this.images.remove(id, imageId, staff);
  }
}
