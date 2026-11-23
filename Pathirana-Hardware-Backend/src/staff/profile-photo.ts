import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  Res,
  StreamableFile,
  UnsupportedMediaTypeException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor, MulterModule } from "@nestjs/platform-express";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import type { Response } from "express";
import { memoryStorage } from "multer";
import sharp from "sharp";
import type { AuthStaff } from "../auth/auth.service";
import { RequirePermission } from "../auth/roles";
import { CurrentStaff, StaffAuthGuard } from "../auth/staff-auth.guard";
import { ALLOWED_UPLOAD_TYPES, inspectImage } from "../catalogue/images.service";
import { AuditService } from "../database/audit.service";
import { DatabaseService } from "../database/database.service";
import { checkUpload, removeVariants, variantName } from "../media/image-variants";
import { putMedia, readMedia, removeQuietly } from "../media/media-read";
import { MEDIA_STORAGE, type MediaStorage } from "../media/media-storage";

/** Profile photos are small: 2 MB upload limit, at least 96 × 96 px, stored as square WebP. */
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const PHOTO_MIN_SIDE = 96;
const SIZES = { full: 512, thumb: 128 } as const;

class SizeQuery {
  @IsOptional() @IsIn(["full", "thumb"]) size?: "full" | "thumb";
  /** Cache key (the photo version) — not used by the server. */
  @IsOptional() @IsString() @MaxLength(100) v?: string;
}

export type PhotoInfo = { photoVersion: string | null };

/**
 * Staff profile photos (migration 0010). Every signed-in staff member manages their OWN photo; an
 * admin may also replace or remove another staff member's photo (Staff Management). Photos are
 * private: stored in the "staff" media area and served only to the photo's owner or an admin
 * (never public, never cached by shared caches). Square centre crop, EXIF rotation applied, all
 * metadata removed. A replaced or removed photo's files are deleted after the database commit.
 */
@Injectable()
export class ProfilePhotoService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
  ) {}

  async info(staffId: string): Promise<PhotoInfo> {
    const r = await this.db.one<{ v: Date | null; key: string | null }>(
      "SELECT photo_updated_at AS v, photo_key AS key FROM staff WHERE id = $1",
      [staffId],
    );
    if (!r) throw new NotFoundException("Staff member not found.");
    return { photoVersion: r.key && r.v ? String(r.v.getTime()) : null };
  }

  private async encode(upload: Express.Multer.File | undefined) {
    const file = checkUpload(upload);
    if (file.size > PHOTO_MAX_BYTES) throw new BadRequestException("Profile photos must be 2 MB or smaller.");
    const meta = await inspectImage(file.buffer);
    // EXIF-rotated dimensions (orientations 5–8 swap width and height).
    if (Math.min(meta.width, meta.height) < PHOTO_MIN_SIDE)
      throw new BadRequestException(
        `Profile photos must be at least ${PHOTO_MIN_SIDE} × ${PHOTO_MIN_SIDE} pixels.`,
      );
    const render = (side: number) =>
      sharp(file.buffer, { limitInputPixels: 40_000_000, failOn: "error" })
        .rotate()
        .resize({ width: side, height: side, fit: "cover", position: "attention", withoutEnlargement: false })
        .webp({ quality: 82 })
        .toBuffer();
    return { full: await render(SIZES.full), thumb: await render(SIZES.thumb) };
  }

  async set(staffId: string, upload: Express.Multer.File | undefined, by: AuthStaff): Promise<PhotoInfo> {
    const img = await this.encode(upload);
    const key = randomUUID();
    await putMedia(this.storage, "staff", variantName(key, "full"), img.full);
    try {
      await putMedia(this.storage, "staff", variantName(key, "thumb"), img.thumb);
    } catch (e) {
      await removeQuietly(this.storage, "staff", [variantName(key, "full")]);
      throw e;
    }
    let previous: string | null = null;
    try {
      const version = await this.db.tx(async (client) => {
        const cur = await client.query<{ photo_key: string | null }>(
          "SELECT photo_key FROM staff WHERE id = $1 FOR UPDATE",
          [staffId],
        );
        if (!cur.rowCount) throw new NotFoundException("Staff member not found.");
        previous = cur.rows[0]!.photo_key;
        const r = await client.query<{ v: Date }>(
          "UPDATE staff SET photo_key = $2, photo_updated_at = clock_timestamp() WHERE id = $1 RETURNING photo_updated_at AS v",
          [staffId, key],
        );
        await this.audit.log(
          by.id,
          previous ? "staff.photo.replace" : "staff.photo.add",
          "staff",
          staffId,
          by.id === staffId ? {} : { byAdmin: true },
          client,
        );
        return String(r.rows[0]!.v.getTime());
      });
      if (previous) await removeVariants(this.storage, "staff", previous);
      return { photoVersion: version };
    } catch (e) {
      await removeVariants(this.storage, "staff", key);
      throw e;
    }
  }

  async remove(staffId: string, by: AuthStaff): Promise<void> {
    const key = await this.db.tx(async (client) => {
      const cur = await client.query<{ photo_key: string | null }>(
        "SELECT photo_key FROM staff WHERE id = $1 FOR UPDATE",
        [staffId],
      );
      if (!cur.rowCount) throw new NotFoundException("Staff member not found.");
      const old = cur.rows[0]!.photo_key;
      if (!old) return null;
      await client.query(
        "UPDATE staff SET photo_key = NULL, photo_updated_at = clock_timestamp() WHERE id = $1",
        [staffId],
      );
      await this.audit.log(
        by.id,
        "staff.photo.remove",
        "staff",
        staffId,
        by.id === staffId ? {} : { byAdmin: true },
        client,
      );
      return old;
    });
    if (key) await removeVariants(this.storage, "staff", key);
  }

  /** Only the photo's owner or an admin may see it. */
  async image(staffId: string, size: "full" | "thumb", viewer: AuthStaff) {
    if (viewer.id !== staffId && viewer.role !== "admin")
      throw new ForbiddenException("You can only view your own profile photo.");
    const r = await this.db.one<{ photo_key: string | null }>("SELECT photo_key FROM staff WHERE id = $1", [
      staffId,
    ]);
    if (!r?.photo_key) throw new NotFoundException("No profile photo.");
    return readMedia(this.storage, "staff", variantName(r.photo_key, size));
  }
}

const sendImage = (res: Response, file: Buffer) => {
  // Private to the signed-in browser; the URL carries ?v=<version>, so a changed photo is a new URL.
  res.setHeader("Cache-Control", "private, max-age=86400");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return new StreamableFile(file, { type: "image/webp" });
};

/** The signed-in staff member's own photo: /api/v1/admin/profile/photo */
@Controller("admin/profile/photo")
@UseGuards(StaffAuthGuard)
export class OwnProfilePhotoController {
  constructor(private readonly photos: ProfilePhotoService) {}

  @Get("info")
  info(@CurrentStaff() me: AuthStaff) {
    return this.photos.info(me.id);
  }

  @Get()
  async view(
    @CurrentStaff() me: AuthStaff,
    @Query() q: SizeQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    return sendImage(res, await this.photos.image(me.id, q.size ?? "full", me));
  }

  @Put()
  @UseInterceptors(FileInterceptor("file"))
  set(@CurrentStaff() me: AuthStaff, @UploadedFile() file: Express.Multer.File | undefined) {
    return this.photos.set(me.id, file, me);
  }

  @Delete()
  @HttpCode(204)
  async remove(@CurrentStaff() me: AuthStaff) {
    await this.photos.remove(me.id, me);
  }
}

/** Any staff member's photo: viewing is owner-or-admin; changing another person's photo is admin-only. */
@Controller("admin/staff/:id/photo")
@UseGuards(StaffAuthGuard)
export class StaffPhotoController {
  constructor(private readonly photos: ProfilePhotoService) {}

  @Get()
  async view(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentStaff() me: AuthStaff,
    @Query() q: SizeQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    return sendImage(res, await this.photos.image(id, q.size ?? "full", me));
  }

  @Put()
  @RequirePermission("staff:manage")
  @UseInterceptors(FileInterceptor("file"))
  set(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentStaff() me: AuthStaff,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.photos.set(id, file, me);
  }

  @Delete()
  @HttpCode(204)
  @RequirePermission("staff:manage")
  async remove(@Param("id", ParseUUIDPipe) id: string, @CurrentStaff() me: AuthStaff) {
    await this.photos.remove(id, me);
  }
}

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: PHOTO_MAX_BYTES, files: 1, fields: 2, parts: 3 },
      fileFilter: (_req: unknown, file: Express.Multer.File, cb: (e: Error | null, ok: boolean) => void) =>
        (ALLOWED_UPLOAD_TYPES as readonly string[]).includes(file.mimetype)
          ? cb(null, true)
          : cb(new UnsupportedMediaTypeException("Only JPEG, PNG or WebP images are accepted."), false),
    }),
  ],
  controllers: [OwnProfilePhotoController, StaffPhotoController],
  providers: [ProfilePhotoService],
})
export class ProfilePhotoModule {}
