import { randomUUID } from "node:crypto";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import sharp from "sharp";
import type { AuthStaff } from "../auth/auth.service";
import { ENV, type Env } from "../config/env";
import { AuditService } from "../database/audit.service";
import { DatabaseService } from "../database/database.service";
import { ALLOWED_UPLOAD_TYPES, inspectImage, type ImageSize } from "./images.service";

const MAX_PIXELS = 40_000_000;
/** Logos are small graphics: kept LOSSLESS (exact pixels and transparency), never enlarged. */
const LOGO_MAX = 800;
const CATEGORY_SIZES = { full: 1600, thumb: 480 } as const;

function checkUpload(file: Express.Multer.File | undefined): Express.Multer.File {
  if (!file) throw new BadRequestException('Attach an image in the "file" field.');
  if (!(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(file.mimetype)) {
    throw new UnsupportedMediaTypeException("Only JPEG, PNG or WebP images are accepted.");
  }
  return file;
}

const pipeline = (buffer: Buffer, max: number) =>
  sharp(buffer, { limitInputPixels: MAX_PIXELS, failOn: "error" })
    .rotate()
    .resize({ width: max, height: max, fit: "inside", withoutEnlargement: true });

const BRAND_COLUMNS = `id, slug, name, is_active AS "isActive", logo_key AS "logoKey",
  logo_width AS "logoWidth", logo_height AS "logoHeight", created_at AS "createdAt", updated_at AS "updatedAt"`;
const CATEGORY_COLUMNS = `id, slug, name, description, sort_order AS "sortOrder", is_active AS "isActive",
  image_key AS "imageKey", image_width AS "imageWidth", image_height AS "imageHeight", image_alt AS "imageAlt",
  created_at AS "createdAt", updated_at AS "updatedAt"`;

/**
 * Brand logos and category images, stored like product images: under
 * UPLOAD_DIR (outside any web root) with server-generated names, decoded and
 * re-encoded before anything is written. Public URLs carry the file key, so a
 * replaced file gets a new URL (no stale caches); files are served only while
 * the brand / category is active.
 */
@Injectable()
export class CatalogueMediaService {
  private readonly brandDir: string;
  private readonly categoryDir: string;

  constructor(
    @Inject(ENV) env: Env,
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {
    this.brandDir = path.resolve(env.UPLOAD_DIR, "brands");
    this.categoryDir = path.resolve(env.UPLOAD_DIR, "categories");
  }

  private logoFile = (key: string) => path.join(this.brandDir, `${key}.webp`);
  private categoryFile = (key: string, size: ImageSize) =>
    path.join(this.categoryDir, size === "thumb" ? `${key}-thumb.webp` : `${key}.webp`);

  // ── Brand logos ─────────────────────────────────────────────────────────────

  async setBrandLogo(brandId: string, upload: Express.Multer.File | undefined, staff: AuthStaff) {
    const file = checkUpload(upload);
    if (!(await this.db.one("SELECT 1 FROM brands WHERE id = $1", [brandId]))) {
      throw new NotFoundException("Brand not found.");
    }
    await inspectImage(file.buffer);
    const out = await pipeline(file.buffer, LOGO_MAX)
      .webp({ lossless: true })
      .toBuffer({ resolveWithObject: true });
    const key = randomUUID();
    await mkdir(this.brandDir, { recursive: true });
    await writeFile(this.logoFile(key), out.data, { flag: "wx" });
    let previous: string | null = null;
    try {
      const row = await this.db.tx(async (client) => {
        const old = await client.query<{ logo_key: string | null }>(
          "SELECT logo_key FROM brands WHERE id = $1 FOR UPDATE",
          [brandId],
        );
        if (!old.rowCount) throw new NotFoundException("Brand not found.");
        previous = old.rows[0]!.logo_key;
        const { rows } = await client.query(
          `UPDATE brands SET logo_key = $2, logo_width = $3, logo_height = $4 WHERE id = $1 RETURNING ${BRAND_COLUMNS}`,
          [brandId, key, out.info.width, out.info.height],
        );
        await this.audit.log(
          staff.id,
          previous ? "brand.logo.replace" : "brand.logo.add",
          "brand",
          brandId,
          {},
          client,
        );
        return rows[0];
      });
      if (previous) await rm(this.logoFile(previous), { force: true });
      return row;
    } catch (e) {
      await rm(this.logoFile(key), { force: true });
      throw e;
    }
  }

  async removeBrandLogo(brandId: string, staff: AuthStaff) {
    const old = await this.db.tx(async (client) => {
      const { rows } = await client.query<{ logo_key: string | null }>(
        "SELECT logo_key FROM brands WHERE id = $1 FOR UPDATE",
        [brandId],
      );
      if (!rows.length) throw new NotFoundException("Brand not found.");
      if (!rows[0]!.logo_key) throw new NotFoundException("This brand has no uploaded logo.");
      await client.query(
        "UPDATE brands SET logo_key = NULL, logo_width = NULL, logo_height = NULL WHERE id = $1",
        [brandId],
      );
      await this.audit.log(staff.id, "brand.logo.remove", "brand", brandId, {}, client);
      return rows[0]!.logo_key;
    });
    await rm(this.logoFile(old), { force: true });
  }

  /** Public: the logo of an ACTIVE brand, by its file key. */
  async publicLogo(key: string) {
    const row = await this.db.one("SELECT 1 FROM brands WHERE logo_key = $1 AND is_active", [key]);
    if (!row) throw new NotFoundException("Logo not found.");
    return this.existing(this.logoFile(key));
  }

  /** Staff: the logo of any brand (inactive ones too). */
  async staffLogo(brandId: string) {
    const row = await this.db.one<{ logo_key: string | null }>("SELECT logo_key FROM brands WHERE id = $1", [
      brandId,
    ]);
    if (!row?.logo_key) throw new NotFoundException("Logo not found.");
    return this.existing(this.logoFile(row.logo_key));
  }

  // ── Category images ─────────────────────────────────────────────────────────

  async setCategoryImage(
    categoryId: string,
    upload: Express.Multer.File | undefined,
    altText: string,
    staff: AuthStaff,
  ) {
    const file = checkUpload(upload);
    if (!(await this.db.one("SELECT 1 FROM categories WHERE id = $1", [categoryId]))) {
      throw new NotFoundException("Category not found.");
    }
    await inspectImage(file.buffer);
    const full = await pipeline(file.buffer, CATEGORY_SIZES.full).webp({ quality: 82 }).toBuffer({
      resolveWithObject: true,
    });
    const thumb = await pipeline(file.buffer, CATEGORY_SIZES.thumb).webp({ quality: 82 }).toBuffer();
    const key = randomUUID();
    await mkdir(this.categoryDir, { recursive: true });
    await writeFile(this.categoryFile(key, "full"), full.data, { flag: "wx" });
    await writeFile(this.categoryFile(key, "thumb"), thumb, { flag: "wx" });
    let previous: string | null = null;
    try {
      const row = await this.db.tx(async (client) => {
        const old = await client.query<{ image_key: string | null }>(
          "SELECT image_key FROM categories WHERE id = $1 FOR UPDATE",
          [categoryId],
        );
        if (!old.rowCount) throw new NotFoundException("Category not found.");
        previous = old.rows[0]!.image_key;
        const { rows } = await client.query(
          `UPDATE categories SET image_key = $2, image_width = $3, image_height = $4, image_alt = $5
            WHERE id = $1 RETURNING ${CATEGORY_COLUMNS}`,
          [categoryId, key, full.info.width, full.info.height, altText.trim()],
        );
        await this.audit.log(
          staff.id,
          previous ? "category.image.replace" : "category.image.add",
          "category",
          categoryId,
          {},
          client,
        );
        return rows[0];
      });
      if (previous) await this.removeCategoryFiles(previous);
      return row;
    } catch (e) {
      await this.removeCategoryFiles(key);
      throw e;
    }
  }

  async setCategoryImageAlt(categoryId: string, altText: string, staff: AuthStaff) {
    const row = await this.db.one(
      `UPDATE categories SET image_alt = $2 WHERE id = $1 AND image_key IS NOT NULL RETURNING ${CATEGORY_COLUMNS}`,
      [categoryId, altText.trim()],
    );
    if (!row) throw new NotFoundException("This category has no uploaded image.");
    await this.audit.log(staff.id, "category.image.update", "category", categoryId, { changed: ["altText"] });
    return row;
  }

  async removeCategoryImage(categoryId: string, staff: AuthStaff) {
    const old = await this.db.tx(async (client) => {
      const { rows } = await client.query<{ image_key: string | null }>(
        "SELECT image_key FROM categories WHERE id = $1 FOR UPDATE",
        [categoryId],
      );
      if (!rows.length) throw new NotFoundException("Category not found.");
      if (!rows[0]!.image_key) throw new NotFoundException("This category has no uploaded image.");
      await client.query(
        "UPDATE categories SET image_key = NULL, image_width = NULL, image_height = NULL, image_alt = NULL WHERE id = $1",
        [categoryId],
      );
      await this.audit.log(staff.id, "category.image.remove", "category", categoryId, {}, client);
      return rows[0]!.image_key;
    });
    await this.removeCategoryFiles(old);
  }

  /** Public: the image of an ACTIVE category, by its file key. */
  async publicCategoryImage(key: string, size: ImageSize) {
    const row = await this.db.one("SELECT 1 FROM categories WHERE image_key = $1 AND is_active", [key]);
    if (!row) throw new NotFoundException("Image not found.");
    return this.existing(this.categoryFile(key, size));
  }

  /** Staff: the image of any category (inactive ones too). */
  async staffCategoryImage(categoryId: string, size: ImageSize) {
    const row = await this.db.one<{ image_key: string | null }>(
      "SELECT image_key FROM categories WHERE id = $1",
      [categoryId],
    );
    if (!row?.image_key) throw new NotFoundException("Image not found.");
    return this.existing(this.categoryFile(row.image_key, size));
  }

  private async existing(file: string) {
    try {
      await access(file);
    } catch {
      throw new NotFoundException("Image not found.");
    }
    return file;
  }

  private async removeCategoryFiles(key: string) {
    await Promise.all([
      rm(this.categoryFile(key, "full"), { force: true }),
      rm(this.categoryFile(key, "thumb"), { force: true }),
    ]);
  }
}

export { BRAND_COLUMNS, CATEGORY_COLUMNS };
