/**
 * Converts owner-approved photos in assets/gallery/ into responsive WebP files
 * in public/images/gallery/ and writes src/content/gallery-manifest.json.
 *
 * Usage: npm run gallery
 *
 * - Original photos stay in assets/gallery/ (not published).
 * - EXIF metadata (including GPS location) is stripped from published files.
 * - Images are auto-rotated using their EXIF orientation.
 */
import sharp from "sharp";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const SRC_DIR = path.join(root, "assets/gallery");
const OUT_DIR = path.join(root, "public/images/gallery");
const MANIFEST = path.join(root, "src/content/gallery-manifest.json");
const WIDTHS = [640, 1280, 1920];
const EXT = /\.(jpe?g|png|webp|avif|tiff?)$/i;

await mkdir(SRC_DIR, { recursive: true });
await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });

const files = (await readdir(SRC_DIR)).filter((f) => EXT.test(f)).sort();
const manifest = {};

for (const file of files) {
  const slug = path
    .basename(file, path.extname(file))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const input = sharp(path.join(SRC_DIR, file)).rotate(); // apply EXIF orientation
  const { width, height } = await input
    .clone()
    .toBuffer({ resolveWithObject: true })
    .then((r) => r.info);
  const variants = [];
  // Every standard width below the original, plus the original resolution itself.
  const targets = [...WIDTHS.filter((w) => w < width), Math.min(width, WIDTHS[WIDTHS.length - 1])];
  for (const target of new Set(targets)) {
    const name = `${slug}-${target}.webp`;
    // sharp drops EXIF/GPS metadata by default unless .withMetadata() is used.
    await input
      .clone()
      .resize({ width: target })
      .webp({ quality: 90, smartSubsample: true })
      .toFile(path.join(OUT_DIR, name));
    variants.push({ width: target, src: `/images/gallery/${name}` });
  }
  manifest[slug] = { width, height, variants };
  console.log(`✓ ${file} → ${slug} (${width}x${height}, ${variants.length} sizes)`);
}

await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
console.log(
  files.length
    ? `\n${files.length} photo(s) processed. Now add matching entries (slug + alt text) to src/content/gallery.ts.`
    : "No photos found in assets/gallery/. The gallery will show its empty state.",
);
