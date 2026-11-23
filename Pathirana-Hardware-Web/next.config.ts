import type { NextConfig } from "next";
import imageSizes from "./src/lib/image-sizes.json";

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

export default nextConfig;
