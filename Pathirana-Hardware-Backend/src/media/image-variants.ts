import { randomUUID } from "node:crypto";
import { BadRequestException, UnsupportedMediaTypeException } from "@nestjs/common";
import sharp from "sharp";
import { ALLOWED_UPLOAD_TYPES, inspectImage } from "../catalogue/images.service";
import { putMedia, removeQuietly } from "./media-read";
import type { MediaArea, MediaStorage } from "./media-storage";

/** The uploaded file must be a real JPEG/PNG/WebP (decoded, not trusted by name or MIME). */
export function checkUpload(file: Express.Multer.File | undefined): Express.Multer.File {
  if (!file) throw new BadRequestException(['Attach an image in the "file" field.']);
  if (!(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(file.mimetype))
    throw new UnsupportedMediaTypeException("Only JPEG, PNG or WebP images are accepted.");
  return file;
}

export const variantName = (key: string, size: "full" | "thumb") =>
  size === "thumb" ? `${key}-thumb.webp` : `${key}.webp`;

/**
 * Re-encodes an upload (EXIF rotation applied, all metadata removed, never enlarged, aspect
 * ratio kept) into a full-size and a thumbnail WebP under a NEW unique key, create-only.
 * If the second write fails the first is removed again (no orphans).
 */
export async function storeVariants(
  storage: MediaStorage,
  area: MediaArea,
  file: Express.Multer.File,
  sizes: { full: number; thumb: number },
) {
  await inspectImage(file.buffer);
  const render = (max: number) =>
    sharp(file.buffer, { limitInputPixels: 40_000_000, failOn: "error" })
      .rotate()
      .resize({ width: max, height: max, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
  const full = await render(sizes.full);
  const thumb = await render(sizes.thumb);
  const key = randomUUID();
  await putMedia(storage, area, variantName(key, "full"), full.data);
  try {
    await putMedia(storage, area, variantName(key, "thumb"), thumb.data);
  } catch (e) {
    await removeQuietly(storage, area, [variantName(key, "full")]);
    throw e;
  }
  return { key, width: full.info.width, height: full.info.height, size: full.info.size };
}

export const removeVariants = (storage: MediaStorage, area: MediaArea, key: string) =>
  removeQuietly(storage, area, [variantName(key, "full"), variantName(key, "thumb")]);
