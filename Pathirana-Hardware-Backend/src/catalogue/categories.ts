import { createReadStream } from "node:fs";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  NotFoundException,
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
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator";
import type { Response } from "express";
import type { AuthStaff } from "../auth/auth.service";
import { RequirePermission } from "../auth/roles";
import { CurrentStaff, StaffAuthGuard } from "../auth/staff-auth.guard";
import { StatusBody } from "../common/dto";
import { slugify } from "../common/text";
import { buildUpdate } from "../common/update";
import { AuditService } from "../database/audit.service";
import { DatabaseService } from "../database/database.service";
import type { ImageSize } from "./images.service";
import { CATEGORY_COLUMNS, CatalogueMediaService } from "./media.service";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export class CreateCategoryBody {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsOptional() @Matches(SLUG) @MaxLength(80) slug?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsInt() @Min(-1000) @Max(1000) sortOrder?: number;
}

export class UpdateCategoryBody {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @Matches(SLUG) @MaxLength(80) slug?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsInt() @Min(-1000) @Max(1000) sortOrder?: number;
}

export class CategoryImageBody {
  @IsString() @MinLength(1) @MaxLength(250) altText!: string;
}

class ImageQuery {
  @IsOptional() @IsIn(["full", "thumb"]) size?: ImageSize;
}

const ADMIN_COLUMNS = CATEGORY_COLUMNS;

@Injectable()
export class CategoriesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  /** Active categories with their count of published products. */
  /** `image` is the staff-uploaded category image (null when none was uploaded). */
  async listPublic() {
    const rows = await this.db.query<{
      slug: string;
      name: string;
      description: string | null;
      productCount: number;
      key: string | null;
      w: number;
      h: number;
      alt: string;
    }>(
      `SELECT c.slug, c.name, c.description,
              (SELECT count(*)::int FROM products p WHERE p.category_id = c.id AND p.is_published) AS "productCount",
              c.image_key AS key, c.image_width AS w, c.image_height AS h, c.image_alt AS alt
         FROM categories c WHERE c.is_active ORDER BY c.sort_order, c.name`,
    );
    return rows.map(({ key, w, h, alt, ...c }) => ({
      ...c,
      image: key
        ? {
            url: `/api/v1/category-images/${key}`,
            thumbUrl: `/api/v1/category-images/${key}?size=thumb`,
            alt,
            width: w,
            height: h,
          }
        : null,
    }));
  }

  listAll() {
    return this.db.query(`SELECT ${ADMIN_COLUMNS} FROM categories ORDER BY sort_order, name`);
  }

  async create(body: CreateCategoryBody, staff: AuthStaff) {
    const slug = body.slug ?? slugify(body.name);
    if (!slug) throw new BadRequestException("Could not create a slug from this name; provide one.");
    const row = await this.db.one<{ id: string }>(
      `INSERT INTO categories (name, slug, description, sort_order) VALUES ($1, $2, $3, $4) RETURNING ${ADMIN_COLUMNS}`,
      [body.name.trim(), slug, body.description ?? null, body.sortOrder ?? 0],
    );
    await this.audit.log(staff.id, "category.create", "category", row!.id, { name: body.name, slug });
    return row;
  }

  async update(id: string, body: UpdateCategoryBody, staff: AuthStaff) {
    const { set, params, changed } = buildUpdate(
      { ...body },
      {
        name: "name",
        slug: "slug",
        description: "description",
        sortOrder: "sort_order",
      },
    );
    const row = await this.db.one(`UPDATE categories SET ${set} WHERE id = $1 RETURNING ${ADMIN_COLUMNS}`, [
      id,
      ...params,
    ]);
    if (!row) throw new NotFoundException("Category not found.");
    await this.audit.log(staff.id, "category.update", "category", id, { changed });
    return row;
  }

  async setActive(id: string, isActive: boolean, staff: AuthStaff) {
    const row = await this.db.one(
      `UPDATE categories SET is_active = $2 WHERE id = $1 RETURNING ${ADMIN_COLUMNS}`,
      [id, isActive],
    );
    if (!row) throw new NotFoundException("Category not found.");
    await this.audit.log(staff.id, isActive ? "category.activate" : "category.deactivate", "category", id);
    return row;
  }
}

@Controller("categories")
export class PublicCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  async list() {
    return { items: await this.categories.listPublic() };
  }
}

/** Uploaded images of ACTIVE categories, by file key. */
@Controller("category-images")
export class PublicCategoryImagesController {
  constructor(private readonly media: CatalogueMediaService) {}

  @Get(":key")
  async get(
    @Param("key", ParseUUIDPipe) key: string,
    @Query() q: ImageQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.media.publicCategoryImage(key, q.size ?? "full");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return new StreamableFile(createReadStream(file), { type: "image/webp" });
  }
}

@Controller("admin/categories")
@UseGuards(StaffAuthGuard)
@RequirePermission("catalogue:write")
export class AdminCategoriesController {
  constructor(
    private readonly categories: CategoriesService,
    private readonly media: CatalogueMediaService,
  ) {}

  @Get()
  async list() {
    return { items: await this.categories.listAll() };
  }

  @Post()
  create(@Body() body: CreateCategoryBody, @CurrentStaff() staff: AuthStaff) {
    return this.categories.create(body, staff);
  }

  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateCategoryBody,
    @CurrentStaff() staff: AuthStaff,
  ) {
    return this.categories.update(id, body, staff);
  }

  @Patch(":id/status")
  setStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: StatusBody,
    @CurrentStaff() staff: AuthStaff,
  ) {
    return this.categories.setActive(id, body.isActive, staff);
  }

  /** multipart/form-data: file (JPEG/PNG/WebP) + altText. Adds or replaces the category image. */
  @Post(":id/image")
  @UseInterceptors(FileInterceptor("file"))
  setImage(
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: CategoryImageBody,
    @CurrentStaff() staff: AuthStaff,
  ) {
    return this.media.setCategoryImage(id, file, body.altText, staff);
  }

  /** Edit the image's alt text. */
  @Patch(":id/image")
  setImageAlt(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: CategoryImageBody,
    @CurrentStaff() staff: AuthStaff,
  ) {
    return this.media.setCategoryImageAlt(id, body.altText, staff);
  }

  @Delete(":id/image")
  @HttpCode(204)
  async removeImage(@Param("id", ParseUUIDPipe) id: string, @CurrentStaff() staff: AuthStaff) {
    await this.media.removeCategoryImage(id, staff);
  }

  /** Staff preview (also for inactive categories); never cached. */
  @Get(":id/image")
  async viewImage(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() q: ImageQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.media.staffCategoryImage(id, q.size ?? "full");
    res.setHeader("Cache-Control", "private, no-store");
    return new StreamableFile(createReadStream(file), { type: "image/webp" });
  }
}
