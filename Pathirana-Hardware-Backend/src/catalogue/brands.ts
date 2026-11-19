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
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import type { AuthStaff } from "../auth/auth.service";
import { RequirePermission } from "../auth/roles";
import { CurrentStaff, StaffAuthGuard } from "../auth/staff-auth.guard";
import { StatusBody } from "../common/dto";
import { slugify } from "../common/text";
import { buildUpdate } from "../common/update";
import { AuditService } from "../database/audit.service";
import { DatabaseService } from "../database/database.service";
import { BRAND_COLUMNS, CatalogueMediaService } from "./media.service";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export class CreateBrandBody {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsOptional() @Matches(SLUG) @MaxLength(80) slug?: string;
}

export class UpdateBrandBody {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @Matches(SLUG) @MaxLength(80) slug?: string;
}

const ADMIN_COLUMNS = BRAND_COLUMNS;

@Injectable()
export class BrandsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  /** Active brands; `logo` is the staff-uploaded logo (null when none was uploaded). */
  async listPublic() {
    const rows = await this.db.query<{
      slug: string;
      name: string;
      key: string | null;
      w: number;
      h: number;
    }>(
      `SELECT slug, name, logo_key AS key, logo_width AS w, logo_height AS h
         FROM brands WHERE is_active ORDER BY name`,
    );
    return rows.map((r) => ({
      slug: r.slug,
      name: r.name,
      logo: r.key ? { url: `/api/v1/brand-logos/${r.key}`, width: r.w, height: r.h } : null,
    }));
  }

  listAll() {
    return this.db.query(`SELECT ${ADMIN_COLUMNS} FROM brands ORDER BY name`);
  }

  async create(body: CreateBrandBody, staff: AuthStaff) {
    const slug = body.slug ?? slugify(body.name);
    if (!slug) throw new BadRequestException("Could not create a slug from this name; provide one.");
    const row = await this.db.one<{ id: string }>(
      `INSERT INTO brands (name, slug) VALUES ($1, $2) RETURNING ${ADMIN_COLUMNS}`,
      [body.name.trim(), slug],
    );
    await this.audit.log(staff.id, "brand.create", "brand", row!.id, { name: body.name, slug });
    return row;
  }

  async update(id: string, body: UpdateBrandBody, staff: AuthStaff) {
    const { set, params, changed } = buildUpdate({ ...body }, { name: "name", slug: "slug" });
    const row = await this.db.one(`UPDATE brands SET ${set} WHERE id = $1 RETURNING ${ADMIN_COLUMNS}`, [
      id,
      ...params,
    ]);
    if (!row) throw new NotFoundException("Brand not found.");
    await this.audit.log(staff.id, "brand.update", "brand", id, { changed });
    return row;
  }

  async setActive(id: string, isActive: boolean, staff: AuthStaff) {
    const row = await this.db.one(
      `UPDATE brands SET is_active = $2 WHERE id = $1 RETURNING ${ADMIN_COLUMNS}`,
      [id, isActive],
    );
    if (!row) throw new NotFoundException("Brand not found.");
    await this.audit.log(staff.id, isActive ? "brand.activate" : "brand.deactivate", "brand", id);
    return row;
  }
}

@Controller("brands")
export class PublicBrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get()
  async list() {
    return { items: await this.brands.listPublic() };
  }
}

/** Uploaded logos of ACTIVE brands (lossless WebP), by file key. */
@Controller("brand-logos")
export class PublicBrandLogosController {
  constructor(private readonly media: CatalogueMediaService) {}

  @Get(":key")
  async get(@Param("key", ParseUUIDPipe) key: string, @Res({ passthrough: true }) res: Response) {
    const file = await this.media.publicLogo(key);
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return new StreamableFile(createReadStream(file), { type: "image/webp" });
  }
}

@Controller("admin/brands")
@UseGuards(StaffAuthGuard)
@RequirePermission("catalogue:write")
export class AdminBrandsController {
  constructor(
    private readonly brands: BrandsService,
    private readonly media: CatalogueMediaService,
  ) {}

  @Get()
  async list() {
    return { items: await this.brands.listAll() };
  }

  @Post()
  create(@Body() body: CreateBrandBody, @CurrentStaff() staff: AuthStaff) {
    return this.brands.create(body, staff);
  }

  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateBrandBody,
    @CurrentStaff() staff: AuthStaff,
  ) {
    return this.brands.update(id, body, staff);
  }

  @Patch(":id/status")
  setStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: StatusBody,
    @CurrentStaff() staff: AuthStaff,
  ) {
    return this.brands.setActive(id, body.isActive, staff);
  }

  /** multipart/form-data: file (JPEG/PNG/WebP). Adds or replaces the brand's logo. */
  @Post(":id/logo")
  @UseInterceptors(FileInterceptor("file"))
  setLogo(
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentStaff() staff: AuthStaff,
  ) {
    return this.media.setBrandLogo(id, file, staff);
  }

  @Delete(":id/logo")
  @HttpCode(204)
  async removeLogo(@Param("id", ParseUUIDPipe) id: string, @CurrentStaff() staff: AuthStaff) {
    await this.media.removeBrandLogo(id, staff);
  }

  /** Staff preview (also for inactive brands); never cached. */
  @Get(":id/logo")
  async viewLogo(@Param("id", ParseUUIDPipe) id: string, @Res({ passthrough: true }) res: Response) {
    const file = await this.media.staffLogo(id);
    res.setHeader("Cache-Control", "private, no-store");
    return new StreamableFile(createReadStream(file), { type: "image/webp" });
  }
}
