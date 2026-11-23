import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
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
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import type { Response } from "express";
import type { AuthStaff } from "../auth/auth.service";
import { RequirePermission } from "../auth/roles";
import { CurrentStaff, StaffAuthGuard } from "../auth/staff-auth.guard";
import { cleanTranslations } from "../common/translations";
import { buildUpdate } from "../common/update";
import { AuditService } from "../database/audit.service";
import { DatabaseService } from "../database/database.service";
import { readMedia } from "../media/media-read";
import { MEDIA_STORAGE, type MediaStorage } from "../media/media-storage";
import { checkUpload, removeVariants, storeVariants, variantName } from "../media/image-variants";

export const SERVICE_ICONS = ["bricks", "truck", "boxes", "bookmark", "lightbulb", "hardhat"] as const;
export const SERVICE_KINDS = [
  "materials",
  "delivery",
  "bulk",
  "reservations",
  "guidance",
  "contractor",
] as const;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SERVICE_TEXT = {
  line: ["title", "shortTitle", "summary", "share"],
  multiline: ["description", "howToAsk"],
};
const ORDER_MSG = "Display order must be a whole number (0 or more).";

class ServiceLocaleText {
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(60) shortTitle?: string;
  @IsOptional() @IsString() @MaxLength(300) summary?: string;
  @IsOptional() @IsString() @MaxLength(3000) description?: string;
  @IsOptional() @IsString() @MaxLength(500) howToAsk?: string;
  @IsOptional() @IsString() @MaxLength(200) share?: string;
}
class ServiceTranslations {
  @IsOptional() @IsObject() @ValidateNested() @Type(() => ServiceLocaleText) ta?: ServiceLocaleText;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => ServiceLocaleText) si?: ServiceLocaleText;
}

class ServiceFields {
  @IsOptional()
  @Matches(SLUG, { message: "URL slug: lowercase letters, digits and hyphens." })
  @MaxLength(80)
  slug?: string;
  @IsOptional() @IsString() @MaxLength(60) shortTitle?: string;
  @IsOptional() @IsString() @MaxLength(500) howToAsk?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  enquireAbout?: string[];
  @IsOptional() @IsString() @MaxLength(200) share?: string;
  @IsOptional() @IsInt({ message: ORDER_MSG }) @Min(0, { message: ORDER_MSG }) @Max(9999) sortOrder?: number;
  @IsOptional() @IsBoolean() isPublished?: boolean;
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ServiceTranslations)
  translations?: ServiceTranslations;
}
export class CreateServiceBody extends ServiceFields {
  @IsString() @MinLength(1, { message: "Enter the service title." }) @MaxLength(120) title!: string;
  @IsString() @MinLength(1, { message: "Enter a short summary." }) @MaxLength(300) summary!: string;
  @IsString() @MinLength(1, { message: "Enter the description." }) @MaxLength(3000) description!: string;
  @IsIn(SERVICE_ICONS) icon!: (typeof SERVICE_ICONS)[number];
  @IsIn(SERVICE_KINDS) kind!: (typeof SERVICE_KINDS)[number];
}
export class UpdateServiceBody extends ServiceFields {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: "Enter the service title." })
  @MaxLength(120)
  title?: string;
  @IsOptional()
  @IsString()
  @MinLength(1, { message: "Enter a short summary." })
  @MaxLength(300)
  summary?: string;
  @IsOptional()
  @IsString()
  @MinLength(1, { message: "Enter the description." })
  @MaxLength(3000)
  description?: string;
  @IsOptional() @IsIn(SERVICE_ICONS) icon?: (typeof SERVICE_ICONS)[number];
  @IsOptional() @IsIn(SERVICE_KINDS) kind?: (typeof SERVICE_KINDS)[number];
}
class PublicationBody {
  @IsBoolean() isPublished!: boolean;
}
class AltBody {
  @IsString() @MinLength(1, { message: "Describe what the image shows." }) @MaxLength(250) altText!: string;
}
class SizeQuery {
  @IsOptional() @IsIn(["full", "thumb"]) size?: "full" | "thumb";
  /** Cache-buster the Admin adds when an image is replaced (?v=…); not used by the server. */
  @IsOptional() @IsString() @MaxLength(100) v?: string;
}

const COLUMNS = `id, slug, title, short_title AS "shortTitle", summary, description, how_to_ask AS "howToAsk",
  enquire_about AS "enquireAbout", share, icon, kind, sort_order AS "sortOrder", is_published AS "isPublished",
  image_key AS "imageKey", image_width AS "imageWidth", image_height AS "imageHeight", image_alt AS "imageAlt",
  translations, created_at AS "createdAt", updated_at AS "updatedAt"`;

const clean = (s: string | undefined) =>
  s === undefined ? undefined : s.normalize("NFC").replace(/\s+/g, " ").trim();
const cleanBlock = (s: string | undefined) =>
  s === undefined
    ? undefined
    : s
        .normalize("NFC")
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map((l) => l.replace(/[ \t]+/g, " ").trim())
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

@Injectable()
export class SiteServicesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
  ) {}

  /** Normalises text and rejects fields that became empty after trimming. */
  private normalise(body: UpdateServiceBody) {
    const out: Record<string, unknown> = {
      title: clean(body.title),
      shortTitle: clean(body.shortTitle),
      summary: clean(body.summary),
      description: cleanBlock(body.description),
      howToAsk: cleanBlock(body.howToAsk),
      share: clean(body.share),
      enquireAbout: body.enquireAbout?.map((x) => clean(x)!).filter(Boolean),
      icon: body.icon,
      kind: body.kind,
      sortOrder: body.sortOrder,
      isPublished: body.isPublished,
      translations:
        body.translations === undefined ? undefined : cleanTranslations(body.translations, SERVICE_TEXT),
    };
    for (const k of ["title", "summary", "description"] as const)
      if (out[k] === "") throw new BadRequestException([`${k} must not be empty`]);
    return out;
  }

  listAdmin() {
    return this.db.query(`SELECT ${COLUMNS} FROM services ORDER BY sort_order, title`);
  }

  listPublic() {
    return this.db.query(
      `SELECT slug, title, short_title AS "shortTitle", summary, description, how_to_ask AS "howToAsk",
              enquire_about AS "enquireAbout", share, icon, kind, sort_order AS "sortOrder", translations,
              CASE WHEN image_key IS NULL THEN NULL ELSE json_build_object(
                'url', '/api/v1/service-images/' || image_key,
                'thumbUrl', '/api/v1/service-images/' || image_key || '?size=thumb',
                'width', image_width, 'height', image_height, 'alt', COALESCE(image_alt, title)) END AS image
         FROM services WHERE is_published ORDER BY sort_order, title`,
    );
  }

  async create(body: CreateServiceBody, staff: AuthStaff) {
    const v = this.normalise(body);
    const slug = body.slug ?? slugify(String(v.title));
    if (!slug) throw new BadRequestException(["Enter a URL slug (letters or digits)."]);
    try {
      const row = await this.db.one<{ id: string }>(
        `INSERT INTO services (slug, title, short_title, summary, description, how_to_ask, enquire_about, share,
                               icon, kind, sort_order, is_published, translations)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING ${COLUMNS}`,
        [
          slug,
          v.title,
          v.shortTitle || v.title,
          v.summary,
          v.description,
          v.howToAsk ?? "",
          v.enquireAbout ?? [],
          v.share ?? "",
          v.icon,
          v.kind,
          v.sortOrder ?? 0,
          v.isPublished ?? false,
          JSON.stringify(v.translations ?? {}),
        ],
      );
      await this.audit.log(staff.id, "service.create", "service", row!.id, {
        slug,
        published: v.isPublished ?? false,
      });
      return row;
    } catch (e) {
      if ((e as { code?: string }).code === "23505")
        throw new ConflictException("Another service already uses this URL slug.");
      throw e;
    }
  }

  async update(id: string, body: UpdateServiceBody, staff: AuthStaff) {
    const v = this.normalise(body);
    if (body.slug !== undefined) v.slug = body.slug;
    if (v.translations !== undefined) v.translations = JSON.stringify(v.translations);
    const { set, params, changed } = buildUpdate(v, {
      slug: "slug",
      title: "title",
      shortTitle: "short_title",
      summary: "summary",
      description: "description",
      howToAsk: "how_to_ask",
      enquireAbout: "enquire_about",
      share: "share",
      icon: "icon",
      kind: "kind",
      sortOrder: "sort_order",
      isPublished: "is_published",
      translations: "translations",
    });
    try {
      const row = await this.db.one(`UPDATE services SET ${set} WHERE id = $1 RETURNING ${COLUMNS}`, [
        id,
        ...params,
      ]);
      if (!row) throw new NotFoundException("Service not found.");
      await this.audit.log(staff.id, "service.update", "service", id, { changed });
      return row;
    } catch (e) {
      if ((e as { code?: string }).code === "23505")
        throw new ConflictException("Another service already uses this URL slug.");
      throw e;
    }
  }

  async setPublished(id: string, published: boolean, staff: AuthStaff) {
    const row = await this.db.one(
      `UPDATE services SET is_published = $2 WHERE id = $1 RETURNING ${COLUMNS}`,
      [id, published],
    );
    if (!row) throw new NotFoundException("Service not found.");
    await this.audit.log(staff.id, published ? "service.publish" : "service.hide", "service", id);
    return row;
  }

  async setImage(id: string, upload: Express.Multer.File | undefined, altText: string, staff: AuthStaff) {
    const file = checkUpload(upload);
    if (!(await this.db.one("SELECT 1 FROM services WHERE id = $1", [id])))
      throw new NotFoundException("Service not found.");
    const alt = altText.trim();
    if (!alt) throw new BadRequestException(["Describe what the image shows."]);
    const img = await storeVariants(this.storage, "services", file, { full: 1600, thumb: 480 });
    let previous: string | null = null;
    try {
      const row = await this.db.tx(async (client) => {
        const old = await client.query<{ image_key: string | null }>(
          "SELECT image_key FROM services WHERE id = $1 FOR UPDATE",
          [id],
        );
        if (!old.rowCount) throw new NotFoundException("Service not found.");
        previous = old.rows[0]!.image_key;
        const r = await client.query(
          `UPDATE services SET image_key = $2, image_width = $3, image_height = $4, image_alt = $5
            WHERE id = $1 RETURNING ${COLUMNS}`,
          [id, img.key, img.width, img.height, alt.slice(0, 250)],
        );
        await this.audit.log(
          staff.id,
          previous ? "service.image.replace" : "service.image.add",
          "service",
          id,
          {},
          client,
        );
        return r.rows[0];
      });
      if (previous) await removeVariants(this.storage, "services", previous);
      return row;
    } catch (e) {
      await removeVariants(this.storage, "services", img.key);
      throw e;
    }
  }

  async setImageAlt(id: string, altText: string, staff: AuthStaff) {
    const row = await this.db.one(
      `UPDATE services SET image_alt = $2 WHERE id = $1 AND image_key IS NOT NULL RETURNING ${COLUMNS}`,
      [id, altText.trim()],
    );
    if (!row) throw new NotFoundException("This service has no uploaded image.");
    await this.audit.log(staff.id, "service.image.update", "service", id);
    return row;
  }

  async removeImage(id: string, staff: AuthStaff) {
    const key = await this.db.tx(async (client) => {
      const r = await client.query<{ image_key: string | null }>(
        "SELECT image_key FROM services WHERE id = $1 FOR UPDATE",
        [id],
      );
      if (!r.rowCount) throw new NotFoundException("Service not found.");
      if (!r.rows[0]!.image_key) throw new NotFoundException("This service has no uploaded image.");
      await client.query(
        "UPDATE services SET image_key = NULL, image_width = NULL, image_height = NULL, image_alt = NULL WHERE id = $1",
        [id],
      );
      await this.audit.log(staff.id, "service.image.remove", "service", id, {}, client);
      return r.rows[0]!.image_key;
    });
    await removeVariants(this.storage, "services", key);
  }

  /** Public image: only while the service is published. */
  async publicImage(key: string, size: "full" | "thumb") {
    if (!(await this.db.one("SELECT 1 FROM services WHERE image_key = $1 AND is_published", [key])))
      throw new NotFoundException("Image not found.");
    return readMedia(this.storage, "services", variantName(key, size));
  }

  async staffImage(id: string, size: "full" | "thumb") {
    const r = await this.db.one<{ image_key: string | null }>(
      "SELECT image_key FROM services WHERE id = $1",
      [id],
    );
    if (!r?.image_key) throw new NotFoundException("Image not found.");
    return readMedia(this.storage, "services", variantName(r.image_key, size));
  }
}

/** Public: published services in display order (the website overlays them on its design). */
@Controller("services")
export class PublicServicesController {
  constructor(private readonly services: SiteServicesService) {}
  @Get()
  async list() {
    return { items: await this.services.listPublic() };
  }
}

@Controller("service-images")
export class PublicServiceImagesController {
  constructor(private readonly services: SiteServicesService) {}
  @Get(":key")
  async get(
    @Param("key", ParseUUIDPipe) key: string,
    @Query() q: SizeQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.services.publicImage(key, q.size ?? "full");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return new StreamableFile(file, { type: "image/webp" });
  }
}

@Controller("admin/services")
@UseGuards(StaffAuthGuard)
@RequirePermission("services:write")
export class AdminServicesController {
  constructor(private readonly services: SiteServicesService) {}

  @Get()
  list() {
    return this.services.listAdmin();
  }

  @Post()
  create(@Body() body: CreateServiceBody, @CurrentStaff() staff: AuthStaff) {
    return this.services.create(body, staff);
  }

  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateServiceBody,
    @CurrentStaff() staff: AuthStaff,
  ) {
    return this.services.update(id, body, staff);
  }

  @Patch(":id/publication")
  publish(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: PublicationBody,
    @CurrentStaff() staff: AuthStaff,
  ) {
    return this.services.setPublished(id, body.isPublished, staff);
  }

  @Post(":id/image")
  @UseInterceptors(FileInterceptor("file"))
  upload(
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body("altText") altText: unknown,
    @CurrentStaff() staff: AuthStaff,
  ) {
    return this.services.setImage(id, file, typeof altText === "string" ? altText : "", staff);
  }

  @Patch(":id/image")
  alt(@Param("id", ParseUUIDPipe) id: string, @Body() body: AltBody, @CurrentStaff() staff: AuthStaff) {
    return this.services.setImageAlt(id, body.altText, staff);
  }

  @Delete(":id/image")
  @HttpCode(204)
  async removeImage(@Param("id", ParseUUIDPipe) id: string, @CurrentStaff() staff: AuthStaff) {
    await this.services.removeImage(id, staff);
  }

  @Get(":id/image")
  async view(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() q: SizeQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.services.staffImage(id, q.size ?? "full");
    res.setHeader("Cache-Control", "private, no-store");
    return new StreamableFile(file, { type: "image/webp" });
  }
}
