/**
 * Prepares every brand / page image used through next/image.
 *
 *  1. Transparent logo: the ORIGINAL logo with its white background removed
 *     (colour-to-alpha on the anti-aliased edges, solid areas keep their exact
 *     original colours). → public/images/pathirana-logo-transparent.png
 *  2. Light logo for dark-green backgrounds: identical, except the black/grey
 *     lettering is shown in cream. The red and green brand mark is untouched.
 *     → public/images/pathirana-logo-transparent-light.png
 *  3. Responsive WebP files (quality 90) for every width next/image may request,
 *     never upscaled beyond the source size. → public/images/opt/
 *  4. App icons and the social-share image (original logo on white).
 *
 *  Homepage photographs and the stand-alone logo mark live in assets/images/
 *  (originals are not published); only their WebP variants are written.
 *  The mark is cleaned of stray specks (tiny disconnected blobs) and trimmed.
 *
 * Usage: npm run assets
 */
import sharp from "sharp";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sizes from "../src/lib/image-sizes.json" with { type: "json" };

const root = path.resolve(import.meta.dirname, "..");
const IMG = path.join(root, "public/images");
const OPT = path.join(IMG, "opt");
const APP = path.join(root, "src/app");
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const WIDTHS = [...sizes.imageSizes, ...sizes.deviceSizes].sort((a, b) => a - b);

const LOGO = path.join(IMG, "pathirana-logo.png");
const LOGO_T = path.join(IMG, "pathirana-logo-transparent.png");
const LOGO_L = path.join(IMG, "pathirana-logo-transparent-light.png");

// ── 1 + 2. Transparent logos ────────────────────────────────────────────────
const SOLID = 0.85; // pixels at least this "inked" keep their original colour, fully opaque
const CREAM = [248, 246, 237];
{
  const { data, info } = await sharp(LOGO).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const dark = Buffer.from(data);
  const light = Buffer.from(data);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    const a = (255 - Math.min(r, g, b)) / 255; // colour-to-alpha against white
    let out;
    if (a < 0.02) out = [0, 0, 0, 0];
    else if (a >= SOLID) out = [r, g, b, 255];
    else out = [r, g, b].map((c) => Math.round(255 - (255 - c) / a)).concat(Math.round(a * 255));
    dark.set(out, i);
    const sat = Math.max(out[0], out[1], out[2]) - Math.min(out[0], out[1], out[2]);
    const lum = 0.299 * out[0] + 0.587 * out[1] + 0.114 * out[2];
    light.set(out[3] > 0 && sat < 60 && lum < 150 ? [...CREAM, out[3]] : out, i);
  }
  const raw = { raw: { width: info.width, height: info.height, channels: 4 } };
  const pad = { top: 8, bottom: 8, left: 8, right: 8, background: { r: 0, g: 0, b: 0, alpha: 0 } };
  const trimmed = await sharp(dark, raw).png().toBuffer();
  const box = await sharp(trimmed).trim().toBuffer({ resolveWithObject: true });
  const { trimOffsetLeft: tl = 0, trimOffsetTop: tt = 0 } = box.info;
  const crop = { left: -tl, top: -tt, width: box.info.width, height: box.info.height };
  await sharp(dark, raw).extract(crop).extend(pad).png({ compressionLevel: 9 }).toFile(LOGO_T);
  await sharp(light, raw).extract(crop).extend(pad).png({ compressionLevel: 9 }).toFile(LOGO_L);
}

// ── 2b. Stand-alone logo mark (transparent) ─────────────────────────────────
const ASSETS = path.join(root, "assets/images");
const MARK_SRC = path.join(ASSETS, "pathirana-logo-mark-source.png");
const MARK = path.join(ASSETS, "pathirana-logo-mark.png");
{
  const { data, info } = await sharp(MARK_SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const label = new Int32Array(W * H).fill(-1);
  const sizesById = [];
  const stack = [];
  for (let start = 0; start < W * H; start++) {
    if (label[start] !== -1 || data[start * 4 + 3] < 40) continue;
    const id = sizesById.length;
    let n = 0;
    label[start] = id;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop();
      n++;
      const x = i % W,
        y = (i - x) / W;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (label[j] === -1 && data[j * 4 + 3] >= 40) {
            label[j] = id;
            stack.push(j);
          }
        }
    }
    sizesById.push(n);
  }
  const keep = Math.max(...sizesById) * 0.02;
  for (let i = 0; i < W * H; i++) {
    const id = label[i];
    if (id === -1 ? data[i * 4 + 3] > 0 : sizesById[id] < keep) data[i * 4 + 3] = 0;
  }
  const clean = await sharp(data, { raw: { width: W, height: H, channels: 4 } })
    .png()
    .toBuffer();
  await sharp(clean)
    .trim()
    .extend({ top: 6, bottom: 6, left: 6, right: 6, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(MARK);
}

// ── 2c. Footer artwork: gold construction artwork on TRANSPARENCY ───────────
// The supplied panorama (public/images/pathirana_footer_header_matching_green.png)
// has its own baked-in green (~#1F4331), which can never match the header's
// forest-900. "Colour to alpha" against that green keeps every gold line and
// object with its original colour, but makes the green itself transparent, so
// the artwork sits seamlessly on the footer's real forest-900 background.
const FOOTER_SRC = path.join(IMG, "pathirana_footer_header_matching_green.png");
const FOOTER_ART = path.join(ASSETS, "pathirana-footer-artwork.png");
{
  const BG = [31, 67, 49]; // median of the artwork's empty green areas
  const FLOOR = 0.1; // ignore the faint vignette / grain in the green itself
  const { data, info } = await sharp(FOOTER_SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let p = 0, q = 0; p < data.length; p += 3, q += 4) {
    let a = 0;
    for (let k = 0; k < 3; k++) {
      const c = data[p + k],
        b = BG[k];
      a = Math.max(a, c > b ? (c - b) / (255 - b) : (b - c) / b);
    }
    const alpha = Math.min(1, Math.max(0, (a - FLOOR) / (1 - FLOOR)));
    if (alpha === 0) continue;
    for (let k = 0; k < 3; k++) {
      // Un-premultiply against the green so colours stay true when composited.
      const v = (data[p + k] - BG[k]) / Math.max(a, 1e-3) + BG[k];
      out[q + k] = Math.max(0, Math.min(255, Math.round(v)));
    }
    out[q + 3] = Math.round(alpha * 255);
  }
  await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(FOOTER_ART);
}

// ── 3. Responsive variants for next/image ───────────────────────────────────
const SOURCES = [
  "pathirana-logo-transparent.png",
  "pathirana-logo-transparent-light.png",
  "pathirana-hero-helmet-banner.png",
  "pathirana-shop-about.png",
  { file: "pathirana-logo-mark.png", dir: ASSETS },
  { file: "pathirana-shop-front.jpg", dir: ASSETS },
  { file: "pathirana-plumbing.jpg", dir: ASSETS },
  { file: "pathirana-tools-paint.png", dir: ASSETS },
  { file: "pathirana-aisle-tools.png", dir: ASSETS },
  { file: "pathirana-aisle-materials.png", dir: ASSETS },
  { file: "pathirana-cta-banner.png", dir: ASSETS },
  { file: "pathirana-hero-construction.png", dir: ASSETS },
  { file: "pathirana-hero-materials.png", dir: ASSETS },
  { file: "pathirana_hardware_storefront.png", dir: ASSETS },
  { file: "pathirana-footer-artwork.png", dir: ASSETS },
  { file: "premium_plywood_showroom_display.png", dir: ASSETS },
  { file: "forest_green_luxury_door_and_window_showroom.png", dir: ASSETS },
  { file: "premium_green_and_gold_gas_cylinder_display.png", dir: ASSETS },
  // Products page (client-supplied photography).
  { file: "product-cement-bags.png", dir: ASSETS },
  { file: "product-tor-bars.png", dir: ASSETS },
  { file: "product-tools-hardware.png", dir: ASSETS },
  { file: "products-cta-banner.png", dir: ASSETS },
  { file: "product-box-bars.png", dir: ASSETS },
  { file: "product-bathroom-sets.png", dir: ASSETS },
  // Contact / gallery artwork (client-supplied, generated — illustrations).
  { file: "contact-hero.png", dir: ASSETS },
  { file: "gallery-store-interior.png", dir: ASSETS },
  { file: "gallery-building-materials.png", dir: ASSETS },
  { file: "gallery-tools-hardware.png", dir: ASSETS },
];
await rm(OPT, { recursive: true, force: true });
await mkdir(OPT, { recursive: true });
const meta = {};
for (const entry of SOURCES) {
  const { file, dir } = typeof entry === "string" ? { file: entry, dir: IMG } : entry;
  const src = path.join(dir, file);
  const { width, height, hasAlpha } = await sharp(src).metadata();
  const base = file.replace(/\.[a-z0-9]+$/i, "");
  meta[`/images/${file}`] = { width, height };
  for (const w of WIDTHS) {
    await sharp(src)
      .resize({ width: Math.min(w, width), withoutEnlargement: true, kernel: "lanczos3" })
      .webp(hasAlpha ? { quality: 92, alphaQuality: 100, effort: 6 } : { quality: 90, smartSubsample: true, effort: 6 })
      .toFile(path.join(OPT, `${base}-${w}.webp`));
  }
  console.log(`✓ ${file} (${width}×${height}) → ${WIDTHS.length} sizes`);
}
await writeFile(path.join(root, "src/lib/image-meta.json"), JSON.stringify(meta, null, 2) + "\n");

// ── 4. Icons + social image (original logo on white) ────────────────────────
await mkdir(path.join(IMG, "brand"), { recursive: true });
const onWhite = await sharp(LOGO)
  .trim({ background: "#ffffff", threshold: 20 })
  .extend({ top: 24, bottom: 24, left: 24, right: 24, background: WHITE })
  .png()
  .toBuffer();
// Browser-tab / home-screen icons: the supplied green-background symbol
// (assets/images/pathirana_hardware_green_icon.png). Cropped slightly around
// the red-and-green mark so it stays recognisable at 16×16; no text, no white.
const GREEN_ICON = path.join(ASSETS, "pathirana_hardware_green_icon.png");
const gMeta = await sharp(GREEN_ICON).metadata();
const gSide = Math.min(gMeta.width, gMeta.height);
// Tighter crop for tiny sizes, roomier for large ones.
const cropFor = (size) => {
  const frac = size <= 48 ? 0.8 : 0.9;
  const side = Math.round(gSide * frac);
  return {
    left: Math.round((gMeta.width - side) / 2),
    top: Math.round((gMeta.height - side) / 2),
    width: side,
    height: side,
  };
};
async function greenIcon(size) {
  return sharp(GREEN_ICON)
    .extract(cropFor(size))
    .resize(size, size, { kernel: "lanczos3" })
    .sharpen(size <= 48 ? { sigma: 0.6 } : undefined)
    .ensureAlpha() // ICO entries must be RGBA PNGs
    .png({ compressionLevel: 9 })
    .toBuffer();
}
/** Minimal multi-size .ico writer (PNG-compressed entries, supported by all modern browsers). */
async function writeIco(sizes, file) {
  const pngs = await Promise.all(sizes.map(greenIcon));
  const header = Buffer.alloc(6 + 16 * sizes.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((s, i) => {
    const e = 6 + i * 16;
    header.writeUInt8(s >= 256 ? 0 : s, e);
    header.writeUInt8(s >= 256 ? 0 : s, e + 1);
    header.writeUInt16LE(1, e + 4); // planes
    header.writeUInt16LE(32, e + 6); // bits per pixel
    header.writeUInt32LE(pngs[i].length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += pngs[i].length;
  });
  await writeFile(file, Buffer.concat([header, ...pngs]));
}
await writeIco([16, 32, 48], path.join(APP, "favicon.ico"));
await writeFile(path.join(APP, "icon.png"), await greenIcon(192));
await writeFile(path.join(APP, "apple-icon.png"), await greenIcon(180));
const ogLogo = await sharp(onWhite).resize({ height: 540, fit: "contain", background: WHITE }).toBuffer();
await sharp({ create: { width: 1200, height: 630, channels: 4, background: WHITE } })
  .composite([{ input: ogLogo, gravity: "center" }])
  .png({ compressionLevel: 9 })
  .toFile(path.join(IMG, "brand/og-image.png"));

console.log("Brand assets written.");
