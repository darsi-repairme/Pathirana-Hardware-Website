import manifest from "./gallery-manifest.json";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  GALLERY
 * ─────────────────────────────────────────────────────────────────────────────
 *  Only genuine, owner-approved photographs of Pathirana Hardware belong here.
 *  No stock photos or AI-generated images.
 *
 *  To add photos (see README → "Replacing gallery images"):
 *   1. Put the original photos in  assets/gallery/  e.g. assets/gallery/storefront.jpg
 *   2. Run  npm run gallery   (creates resized WebP files + gallery-manifest.json)
 *   3. Add an entry below whose `slug` matches the file name (without extension)
 *      and write accurate alt text describing what the photo shows.
 *
 *  Entries without a processed image are skipped automatically, so the site
 *  never shows a broken image.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type GalleryEntry = {
  /** File name of the source photo without extension. */
  slug: string;
  /** Describe what is in the photo for people who cannot see it. */
  alt: string;
  /** Optional short caption shown under the photo. */
  caption?: string;
};

export const galleryEntries: readonly GalleryEntry[] = [
  {
    slug: "storefront",
    alt: "Pathirana Hardware storefront with its red signboard, glass entrance and building materials displayed outside",
    caption: "Our store",
  },
];

// ── Implementation (no need to edit below) ───────────────────────────────────

export type GalleryImage = {
  id: string;
  alt: string;
  caption?: string;
  width: number;
  height: number;
  /** Smallest/default source. */
  src: string;
  srcSet: string;
  /** Optional label on the thumbnail, e.g. "Illustration" or "Our store". */
  badge?: string;
};

type ManifestEntry = { width: number; height: number; variants: { width: number; src: string }[] };
const typedManifest = manifest as Record<string, ManifestEntry>;

function fromManifest(entry: GalleryEntry): GalleryImage | null {
  const m = typedManifest[entry.slug];
  if (!m || m.variants.length === 0) return null;
  const sorted = [...m.variants].sort((a, b) => a.width - b.width);
  const fallback = sorted[1] ?? sorted[0];
  if (!fallback) return null;
  return {
    id: entry.slug,
    alt: entry.alt,
    caption: entry.caption,
    width: m.width,
    height: m.height,
    src: fallback.src,
    srcSet: sorted.map((v) => `${v.src} ${v.width}w`).join(", "),
  };
}

/**
 * Clearly-labelled synthetic test patterns used ONLY by the automated test
 * build (PH_GALLERY_FIXTURES=1) to exercise the lightbox. Never enabled in
 * production builds.
 */
function testFixtures(): GalleryImage[] {
  const shapes: [number, number][] = [
    [1200, 900],
    [900, 1200],
    [1200, 800],
    [1000, 1000],
    [1200, 900],
  ];
  return shapes.map(([w, h], i) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#e6efe9"/><path d="M0 ${h}L${w} 0" stroke="#0f5d3a" stroke-width="6"/><text x="50%" y="50%" text-anchor="middle" font-family="sans-serif" font-size="64" fill="#1f1f1f">Test pattern ${i + 1}</text></svg>`;
    const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    return {
      id: `fixture-${i + 1}`,
      alt: `Automated test pattern ${i + 1}`,
      caption: `Test pattern ${i + 1}`,
      width: w,
      height: h,
      src,
      srcSet: `${src} ${w}w`,
    };
  });
}

export function getGalleryImages(): GalleryImage[] {
  if (process.env.PH_GALLERY_FIXTURES === "1") return testFixtures();
  return galleryEntries.map(fromManifest).filter((x): x is GalleryImage => x !== null);
}

/**
 * Photos the owner is asked to supply (shown in README / docs, not to visitors).
 */
export const requestedPhotos = [
  "Storefront from Pallama Road, with the signboard visible",
  "Store interior / main aisles",
  "Building materials area (cement, steel, roofing — whatever is stocked)",
  "Tools and fittings displays",
  "Counter / customer service area",
  "Delivery vehicle (only if delivery is confirmed)",
] as const;
