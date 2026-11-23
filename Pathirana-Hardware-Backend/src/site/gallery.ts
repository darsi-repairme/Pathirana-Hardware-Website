import {
  BadRequestException,
  Body,
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
import { plainToInstance, Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
  validate,
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

const GALLERY_TEXT = { line: ["title", "caption", "altText"] };
const ORDER_MSG = "Display order must be a whole number (0 or more).";
const SIZES = { full: 2000, thumb: 640 } as const;

class GalleryLocaleText {
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(300) caption?: string;
  @IsOptional() @IsString() @MaxLength(250) altText?: string;
}
class GalleryTranslations {
  @IsOptional() @IsObject() @ValidateNested() @Type(() => GalleryLocaleText) ta?: GalleryLocaleText;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => GalleryLocaleText) si?: GalleryLocaleText;
}

export class GalleryFields {
  @IsOptional() @IsString() @MinLength(1, { message: "Enter a title." }) @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(300) caption?: string;
  @IsOptional()
  @IsString()
  @MinLength(1, { message: "Describe what the photo shows." })
  @MaxLength(250)
  altText?: string;
  @IsOptional() @IsString() @MaxLength(60) collection?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: ORDER_MSG })
  @Min(0, { message: ORDER_MSG })
  @Max(9999)
  sortOrder?: number;
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => GalleryTranslations)
  translations?: GalleryTranslations;
}
/** Multipart upload fields arrive as strings: title + alt text required; the photo starts HIDDEN. */
class UploadFields {
  @IsString() @MinLength(1, { message: "Enter a title." }) @MaxLength(120) title!: string;
  @IsString() @MinLength(1, { message: "Describe what the photo shows." }) @MaxLength(250) altText!: string;
  @IsOptional() @IsString() @MaxLength(300) caption?: string;
  @IsOptional() @IsString() @MaxLength(60) collection?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: ORDER_MSG })
  @Min(0, { message: ORDER_MSG })
  @Max(9999)
  sortOrder?: number;
}
class PublicationBody {
  @IsBoolean() isPublished!: boolean;
}
class SizeQuery {
  @IsOptional() @IsIn(["full", "thumb"]) size?: "full" | "thumb";
  /** Cache-buster the Admin adds when an image is replaced (?v=…); not used by the server. */
  @IsOptional() @IsString() @MaxLength(100) v?: string;
}

const COLUMNS = `id, title, caption, alt_text AS "altText", collection, sort_order AS "sortOrder",
  is_published AS "isPublished", width, height, size_bytes AS "sizeBytes", translations,
  created_at AS "createdAt", updated_at AS "updatedAt"`;
const one = (s: string | undefined) =>
  s === undefined ? undefined : s.normalize("NFC").replace(/\s+/g, " ").trim();

@Injectable()
export class GalleryService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
  ) {}

  listAdmin() {
    return this.db.query(`SELECT ${COLUMNS} FROM gallery_photos ORDER BY sort_order, created_at`);
  }

  listPublic() {
    return this.db.query(
      `SELECT id, title, caption, alt_text AS "altText", collection, width, height, translations,
              '/api/v1/gallery-images/' || id AS url, '/api/v1/gallery-images/' || id || '?size=thumb' AS "thumbUrl"
         FROM gallery_photos WHERE is_published ORDER BY sort_order, created_at`,
    );
  }

  async upload(upload: Express.Multer.File | undefined, raw: Record<string, unknown>, staff: AuthStaff) {
    const fields = plainToInstance(UploadFields, raw);
    const issues = await validate(fields, { whitelist: true, forbidNonWhitelisted: false });
    if (issues.length)
      throw new BadRequestException(issues.flatMap((i) => Object.values(i.constraints ?? {})));
    const title = one(fields.title)!;
    const alt = one(fields.altText)!;
    if (!title || !alt) throw new BadRequestException(["Enter a title and describe what the photo shows."]);
    const file = checkUpload(upload);
    const img = await storeVariants(this.storage, "gallery", file, SIZES);
    try {
      const row = await this.db.one<{ id: string }>(
        `INSERT INTO gallery_photos (storage_key, width, height, size_bytes, title, caption, alt_text, collection,
                                     sort_order, is_published, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, $10) RETURNING ${COLUMNS}`,
        [
          img.key,
          img.width,
          img.height,
          img.size,
          title,
          one(fields.caption) || null,
          alt,
          one(fields.collection) || null,
          fields.sortOrder ?? 0,
          staff.id,
        ],
      );
      await this.audit.log(staff.id, "gallery.add", "gallery", row!.id, {});
      return row;
    } catch (e) {
      await removeVariants(this.storage, "gallery", img.key);
      throw e;
    }
  }

  async update(id: string, body: GalleryFields, staff: AuthStaff) {
    const v: Record<string, unknown> = {
      title: one(body.title),
      caption: body.caption === undefined ? undefined : one(body.caption) || null,
      altText: one(body.altText),
      collection: body.collection === undefined ? undefined : one(body.collection) || null,
      sortOrder: body.sortOrder,
      translations:
        body.translations === undefined
          ? undefined
          : JSON.stringify(cleanTranslations(body.translations, GALLERY_TEXT)),
    };
    if (v.title === "" || v.altText === "")
      throw new BadRequestException(["Title and description must not be empty."]);
    const { set, params, changed } = buildUpdate(v, {
      title: "title",
      caption: "caption",
      altText: "alt_text",
      collection: "collection",
      sortOrder: "sort_order",
      translations: "translations",
    });
    const row = await this.db.one(`UPDATE gallery_photos SET ${set} WHERE id = $1 RETURNING ${COLUMNS}`, [
      id,
      ...params,
    ]);
    if (!row) throw new NotFoundException("Photo not found.");
    await this.audit.log(staff.id, "gallery.update", "gallery", id, { changed });
    return row;
  }

  async setPublished(id: string, published: boolean, staff: AuthStaff) {
    const row = await this.db.one(
      `UPDATE gallery_photos SET is_published = $2 WHERE id = $1 RETURNING ${COLUMNS}`,
      [id, published],
    );
    if (!row) throw new NotFoundException("Photo not found.");
    await this.audit.log(staff.id, published ? "gallery.publish" : "gallery.hide", "gallery", id);
    return row;
  }

  /** Replaces the image file; the record (title, order, publication) is kept. */
  async replace(id: string, upload: Express.Multer.File | undefined, staff: AuthStaff) {
    const file = checkUpload(upload);
    if (!(await this.db.one("SELECT 1 FROM gallery_photos WHERE id = $1", [id])))
      throw new NotFoundException("Photo not found.");
    const img = await storeVariants(this.storage, "gallery", file, SIZES);
    let previous: string | null = null;
    try {
      const row = await this.db.tx(async (client) => {
        const old = await client.query<{ storage_key: string }>(
          "SELECT storage_key FROM gallery_photos WHERE id = $1 FOR UPDATE",
          [id],
        );
        if (!old.rowCount) throw new NotFoundException("Photo not found.");
        previous = old.rows[0]!.storage_key;
        const r = await client.query(
          `UPDATE gallery_photos SET storage_key = $2, width = $3, height = $4, size_bytes = $5
            WHERE id = $1 RETURNING ${COLUMNS}`,
          [id, img.key, img.width, img.height, img.size],
        );
        await this.audit.log(staff.id, "gallery.replace", "gallery", id, {}, client);
        return r.rows[0];
      });
      if (previous) await removeVariants(this.storage, "gallery", previous);
      return row;
    } catch (e) {
      await removeVariants(this.storage, "gallery", img.key);
      throw e;
    }
  }

  /** Deletes the record first, then the files (a failed file removal only leaves an unused object, logged). */
  async remove(id: string, staff: AuthStaff) {
    const key = await this.db.tx(async (client) => {
      const r = await client.query<{ storage_key: string; title: string }>(
        "DELETE FROM gallery_photos WHERE id = $1 RETURNING storage_key, title",
        [id],
      );
      if (!r.rowCount) throw new NotFoundException("Photo not found.");
      await this.audit.log(staff.id, "gallery.delete", "gallery", id, { title: r.rows[0]!.title }, client);
      return r.rows[0]!.storage_key;
    });
    await removeVariants(this.storage, "gallery", key);
  }

  /** Public image: only while the photo is published. */
  async publicImage(id: string, size: "full" | "thumb") {
    const r = await this.db.one<{ storage_key: string }>(
      "SELECT storage_key FROM gallery_photos WHERE id = $1 AND is_published",
      [id],
    );
    if (!r) throw new NotFoundException("Image not found.");
    return readMedia(this.storage, "gallery", variantName(r.storage_key, size));
  }

  async staffImage(id: string, size: "full" | "thumb") {
    const r = await this.db.one<{ storage_key: string }>(
      "SELECT storage_key FROM gallery_photos WHERE id = $1",
      [id],
    );
    if (!r) throw new NotFoundException("Image not found.");
    return readMedia(this.storage, "gallery", variantName(r.storage_key, size));
  }
}

@Controller("gallery")
export class PublicGalleryController {
  constructor(private readonly gallery: GalleryService) {}
  @Get()
  async list() {
    return { items: await this.gallery.listPublic() };
  }
}

@Controller("gallery-images")
export class PublicGalleryImagesController {
  constructor(private readonly gallery: GalleryService) {}
  @Get(":id")
  async get(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() q: SizeQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.gallery.publicImage(id, q.size ?? "full");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Cache-Control", "public, max-age=600");
    return new StreamableFile(file, { type: "image/webp" });
  }
}

@Controller("admin/gallery")
@UseGuards(StaffAuthGuard)
@RequirePermission("gallery:write")
export class AdminGalleryController {
  constructor(private readonly gallery: GalleryService) {}

  @Get()
  list() {
    return this.gallery.listAdmin();
  }

  @Post()
  @UseInterceptors(FileInterceptor("file"))
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: Record<string, unknown>,
    @CurrentStaff() staff: AuthStaff,
  ) {
    return this.gallery.upload(file, body ?? {}, staff);
  }

  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: GalleryFields,
    @CurrentStaff() staff: AuthStaff,
  ) {
    return this.gallery.update(id, body, staff);
  }

  @Patch(":id/publication")
  publish(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: PublicationBody,
    @CurrentStaff() staff: AuthStaff,
  ) {
    return this.gallery.setPublished(id, body.isPublished, staff);
  }

  @Post(":id/image")
  @UseInterceptors(FileInterceptor("file"))
  replace(
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentStaff() staff: AuthStaff,
  ) {
    return this.gallery.replace(id, file, staff);
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@Param("id", ParseUUIDPipe) id: string, @CurrentStaff() staff: AuthStaff) {
    await this.gallery.remove(id, staff);
  }

  @Get(":id/image")
  async view(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() q: SizeQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.gallery.staffImage(id, q.size ?? "full");
    res.setHeader("Cache-Control", "private, no-store");
    return new StreamableFile(file, { type: "image/webp" });
  }
}
