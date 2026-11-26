import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import imageSizes from "./src/lib/image-sizes.json";

/**
 * The website shows ONLY the live database (services, products, categories, brands, gallery,
 * offers) through the website API — nothing bundled with the site is used as content. A
 * production build without NEXT_PUBLIC_API_URL would show only "unavailable" messages, so it is
 * refused. (Automated tests that deliberately build without an API set PH_ALLOW_NO_API=1.)
 */
function requireApiUrl(phase: string) {
  if (phase !== PHASE_PRODUCTION_BUILD || process.env.PH_ALLOW_NO_API === "1") return;
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  let ok = false;
  try {
    ok = !!raw && ["http:", "https:"].includes(new URL(raw).protocol);
  } catch {
    ok = false;
  }
  if (!ok) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not set (or not a valid http/https URL). The website shows only the live " +
        "database, so it needs the website API address at build time — e.g. NEXT_PUBLIC_API_URL=http://127.0.0.1:4000 " +
        "in .env.local (see .env.example).",
    );
  }
}

/**
 * Static export configuration.
 *
 * The site is fully static (no server, database or API) so it can be hosted on
 * any low-cost static host. Security headers cannot be set from Next.js in
 * export mode; they are generated after the build by `scripts/postbuild.mjs`
 * (see README → Deployment).
 */
const nextConfig: NextConfig = {
  output: "export",
  // `/about` is emitted as `/about/index.html`, which every static host serves.
  trailingSlash: true,
  // Allows a separate build folder for the gallery test fixture build.
  distDir: process.env.PH_DIST_DIR || undefined,
  reactStrictMode: true,
  experimental: {
    // Inlines the (small, Tailwind-generated) CSS into each page so first-time
    // mobile visitors avoid a render-blocking round trip.
    inlineCss: true,
  },
  poweredByHeader: false,
  images: {
    // Static export has no image server: images are pre-rendered at build
    // time by `npm run assets` and mapped by this loader.
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    deviceSizes: imageSizes.deviceSizes,
    imageSizes: imageSizes.imageSizes,
    qualities: [90],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default function config(phase: string): NextConfig {
  requireApiUrl(phase);
  return nextConfig;
}
