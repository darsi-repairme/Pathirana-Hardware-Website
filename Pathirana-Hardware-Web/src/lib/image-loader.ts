"use client";

import sizes from "./image-sizes.json";

/**
 * next/image loader for the static export.
 *
 * `npm run assets` pre-renders every image in public/images that is used
 * through next/image into public/images/opt/<name>-<width>.webp, one file per
 * width in image-sizes.json (never upscaled beyond the source resolution).
 * This loader maps a request to the matching pre-rendered file.
 */
const WIDTHS = [...sizes.imageSizes, ...sizes.deviceSizes].sort((a, b) => a - b);
const MAX = WIDTHS[WIDTHS.length - 1] ?? 1920;

export default function imageLoader({ src, width }: { src: string; width: number; quality?: number }) {
  const w = WIDTHS.find((x) => x >= width) ?? MAX;
  const base = src.replace(/^\/images\//, "").replace(/\.[a-z0-9]+$/i, "");
  return `/images/opt/${base}-${w}.webp`;
}
