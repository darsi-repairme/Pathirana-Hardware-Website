import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import sharp, { type Metadata } from "sharp";
import type { AuthStaff } from "../auth/auth.service";
import { AuditService } from "../database/audit.service";
import { DatabaseService } from "../database/database.service";
import { MEDIA_STORAGE, type MediaStorage } from "../media/media-storage";
import { putMedia, readMedia, removeQuietly } from "../media/media-read";

export const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);
const MAX_PIXELS = 40_000_000;
const MAX_DIMENSION = 12_000;
const SIZES = { full: 1600, thumb: 480 } as const;
/**
 * Smallest product image accepted (shorter side, px). Cards show the 480 px thumbnail and the detail
 * page a 4:3 image up to ~600 px wide; below 400 px photos look blurry there (audit ADM-6, a 50×50
 * image was accepted). Product images only — gallery, logos and photos keep their own rules.
 */
export const PRODUCT_IMAGE_MIN_SIDE = 400;
export type ImageSize = keyof typeof SIZES;

/**
 * Confirms the bytes really are a JPEG, PNG or WebP image by decoding the
 * header (the client's file name and MIME type are not trusted).
 */
export async function inspectImage(
  buffer: Buffer,
): Promise<{ format: string; width: number; height: number }> {
  let meta: Metadata;
  try {
    meta = await sharp(buffer, { limitInputPixels: MAX_PIXELS, failOn: "error" }).metadata();
  } catch {
    throw new UnsupportedMediaTypeException("The file is not a valid JPEG, PNG or WebP image.");
  }
  if (!meta.format || !ALLOWED_FORMATS.has(meta.format) || !meta.width || !meta.height) {
    throw new UnsupportedMediaTypeException("Only JPEG, PNG or WebP images are accepted.");
  }
  if (meta.width > MAX_DIMENSION || meta.height > MAX_DIMENSION) {
    throw new BadRequestException(`Images must be at most ${MAX_DIMENSION} pixels on each side.`);
  }
  return { format: meta.format, width: meta.width, height: meta.height };
}

/** Re-encodes to WebP (applies EXIF rotation, strips all metadata), never enlarging. */
async function render(buffer: Buffer, max: number) {
  return sharp(buffer, { limitInputPixels: MAX_PIXELS, failOn: "error" })
    .rotate()
    .resize({ width: max, height: max, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
}

type ImageRow = { id: string; storage_key: string };
const IMAGE_COLUMNS = `id, alt_text AS "altText", width, height, size_bytes AS "sizeBytes",
  sort_order AS "sortOrder", is_main AS "isMain"`;

/**
 * Product images, in MediaStorage area "products" (local UPLOAD_DIR or the private
 * Supabase catalogue bucket) with server-generated names: <uuid>.webp and <uuid>-thumb.webp.
 * They are served only through the API, and only while the product is
 * published and its category active.
 */
@Injectable()
export class ProductImagesService {
  constructor(
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  private file(key: string, size: ImageSize) {
    return size === "thumb" ? `${key}-thumb.webp` : `${key}.webp`;
  }

  /** Adds an image. The product's first image, or one uploaded with makeMain, becomes the main image. */
  async upload(
    productId: string,
    file: Express.Multer.File | undefined,
    altText: string,
    staff: AuthStaff,
    makeMain = false,
  ) {
    if (!file) throw new BadRequestException('Attach an image in the "file" field.');
    if (!(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(file.mimetype)) {
      throw new UnsupportedMediaTypeException("Only JPEG, PNG or WebP images are accepted.");
    }
    const product = await this.db.one("SELECT id FROM products WHERE id = $1", [productId]);
    if (!product) throw new NotFoundException("Product not found.");
    const meta = await inspectImage(file.buffer);
    if (Math.min(meta.width, meta.height) < PRODUCT_IMAGE_MIN_SIDE) {
      throw new BadRequestException(
        `Product images must be at least ${PRODUCT_IMAGE_MIN_SIDE} × ${PRODUCT_IMAGE_MIN_SIDE} pixels (this one is ${meta.width} × ${meta.height}).`,
      );
    }

    const key = randomUUID();
    const full = await render(file.buffer, SIZES.full);
    const thumb = await render(file.buffer, SIZES.thumb);
    await putMedia(this.storage, "products", this.file(key, "full"), full.data);
    try {
      await putMedia(this.storage, "products", this.file(key, "thumb"), thumb.data);
      return await this.db.tx(async (client) => {
        // Locks the product: image changes for one product are serialised (one main image).
        const locked = await client.query("SELECT 1 FROM products WHERE id = $1 FOR UPDATE", [productId]);
        if (!locked.rowCount) throw new NotFoundException("Product not found.");
        const hasMain = (
          await client.query("SELECT 1 FROM product_images WHERE product_id = $1 AND is_main", [productId])
        ).rowCount;
        const isMain = makeMain || !hasMain;
        if (isMain && hasMain) {
          await client.query("UPDATE product_images SET is_main = false WHERE product_id = $1 AND is_main", [
            productId,
          ]);
        }
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO product_images (product_id, storage_key, mime_type, width, height, size_bytes, alt_text,
                                       sort_order, is_main, created_by)
           VALUES ($1, $2, 'image/webp', $3, $4, $5, $6,
                   (SELECT coalesce(max(sort_order) + 1, 0) FROM product_images WHERE product_id = $1), $7, $8)
           RETURNING ${IMAGE_COLUMNS}`,
          [
            productId,
            key,
            full.info.width,
            full.info.height,
            full.info.size,
            altText.trim(),
            isMain,
            staff.id,
          ],
        );
        const row = rows[0]!;
        await this.audit.log(
          staff.id,
          "product.image.add",
          "product",
          productId,
          { imageId: row.id, isMain },
          client,
        );
        return row;
      });
    } catch (e) {
      await this.removeFiles(key);
      throw e;
    }
  }

  /** Edits the alt text and/or makes this image the product's main image. */
  async update(
    productId: string,
    imageId: string,
    changes: { altText?: string; isMain?: boolean },
    staff: AuthStaff,
  ) {
    if (changes.altText === undefined && changes.isMain === undefined) {
      throw new BadRequestException("Nothing to update.");
    }
    if (changes.isMain === false) {
      throw new BadRequestException("To change the main image, make another image the main image.");
    }
    return this.db.tx(async (client) => {
      await client.query("SELECT 1 FROM products WHERE id = $1 FOR UPDATE", [productId]);
      const found = await client.query("SELECT 1 FROM product_images WHERE id = $1 AND product_id = $2", [
        imageId,
        productId,
      ]);
      if (!found.rowCount) throw new NotFoundException("Image not found.");
      const changed: string[] = [];
      if (changes.isMain) {
        await client.query(
          "UPDATE product_images SET is_main = false WHERE product_id = $1 AND is_main AND id <> $2",
          [productId, imageId],
        );
        await client.query("UPDATE product_images SET is_main = true WHERE id = $1", [imageId]);
        changed.push("isMain");
      }
      if (changes.altText !== undefined) {
        await client.query("UPDATE product_images SET alt_text = $2 WHERE id = $1", [
          imageId,
          changes.altText.trim(),
        ]);
        changed.push("altText");
      }
      await this.audit.log(
        staff.id,
        "product.image.update",
        "product",
        productId,
        { imageId, changed },
        client,
      );
      return (await client.query(`SELECT ${IMAGE_COLUMNS} FROM product_images WHERE id = $1`, [imageId]))
        .rows[0];
    });
  }

  /** Deletes an image; when it was the main image, the next image becomes the main one. */
  async remove(productId: string, imageId: string, staff: AuthStaff) {
    const row = await this.db.tx(async (client) => {
      await client.query("SELECT 1 FROM products WHERE id = $1 FOR UPDATE", [productId]);
      const { rows } = await client.query<ImageRow & { is_main: boolean }>(
        "DELETE FROM product_images WHERE id = $1 AND product_id = $2 RETURNING id, storage_key, is_main",
        [imageId, productId],
      );
      const deleted = rows[0];
      if (!deleted) throw new NotFoundException("Image not found.");
      if (deleted.is_main) {
        await client.query(
          `UPDATE product_images SET is_main = true WHERE id = (
             SELECT id FROM product_images WHERE product_id = $1 ORDER BY sort_order, created_at LIMIT 1)`,
          [productId],
        );
      }
      await this.audit.log(staff.id, "product.image.remove", "product", productId, { imageId }, client);
      return deleted;
    });
    await this.removeFiles(row.storage_key);
  }

  /** Any image of a product, for signed-in staff (drafts included). */
  async staffFile(productId: string, imageId: string, size: ImageSize): Promise<Buffer> {
    const row = await this.db.one<ImageRow>(
      "SELECT id, storage_key FROM product_images WHERE id = $1 AND product_id = $2",
      [imageId, productId],
    );
    if (!row) throw new NotFoundException("Image not found.");
    return readMedia(this.storage, "products", this.file(row.storage_key, size));
  }

  /** A publicly visible image (published product, active category), or 404. */
  async publicFile(imageId: string, size: ImageSize): Promise<Buffer> {
    const row = await this.db.one<ImageRow>(
      `SELECT i.id, i.storage_key FROM product_images i
         JOIN products p ON p.id = i.product_id AND p.is_published
         JOIN categories c ON c.id = p.category_id AND c.is_active
        WHERE i.id = $1`,
      [imageId],
    );
    if (!row) throw new NotFoundException("Image not found.");
    return readMedia(this.storage, "products", this.file(row.storage_key, size));
  }

  /**
   * PERMANENTLY deletes a product (admin only; unpublishing is the routine action).
   * `confirmSlug` must equal the product's slug. Its images (rows and files) and brand links
   * go with it; quotation history is kept — those items keep the product name as submitted
   * and only lose the link. Returns how many quotation items referred to it.
   */
  async deleteProduct(productId: string, confirmSlug: string, staff: AuthStaff) {
    const result = await this.db.tx(async (client) => {
      const { rows } = await client.query<{ slug: string; name: string }>(
        "SELECT slug, name FROM products WHERE id = $1 FOR UPDATE",
        [productId],
      );
      const product = rows[0];
      if (!product) throw new NotFoundException("Product not found.");
      if (confirmSlug !== product.slug) {
        throw new BadRequestException("Type the product's URL slug exactly to confirm permanent deletion.");
      }
      const keys = (
        await client.query<{ storage_key: string }>(
          "SELECT storage_key FROM product_images WHERE product_id = $1",
          [productId],
        )
      ).rows.map((r) => r.storage_key);
      const quotationItems = (
        await client.query<{ n: number }>(
          "SELECT count(*)::int AS n FROM quotation_items WHERE product_id = $1",
          [productId],
        )
      ).rows[0]!.n;
      await client.query("DELETE FROM products WHERE id = $1", [productId]);
      await this.audit.log(
        staff.id,
        "product.delete",
        "product",
        productId,
        { name: product.name, slug: product.slug, images: keys.length, quotationItemsKept: quotationItems },
        client,
      );
      return { keys, quotationItems };
    });
    await Promise.all(result.keys.map((k) => this.removeFiles(k)));
    return { deleted: true, imagesRemoved: result.keys.length, quotationItemsKept: result.quotationItems };
  }

  private async removeFiles(key: string) {
    await removeQuietly(this.storage, "products", [this.file(key, "full"), this.file(key, "thumb")]);
  }
}
