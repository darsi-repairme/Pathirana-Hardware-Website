import { getGalleryImages, type GalleryImage } from "@/content/gallery";
import { images } from "@/lib/images";
import sizes from "@/lib/image-sizes.json";

/**
 * Gallery groups for /gallery/ and the About page preview.
 *
 *  • "Our store" holds ONLY genuine photographs of Pathirana Hardware
 *    (the processed gallery photos plus the shop-front photograph).
 *  • The other groups reuse the site's illustrative artwork. Every one is
 *    labelled "Illustration" so it is never mistaken for a photo of the shop.
 */
export type GalleryCollection = {
  id: string;
  title: string;
  description: string;
  kind: "photo" | "illustration";
  images: GalleryImage[];
};

type SiteImage = { src: string; alt: string; width: number; height: number };

const WIDTHS = [...sizes.imageSizes, ...sizes.deviceSizes].filter((w) => w >= 384).sort((a, b) => a - b);

/** Builds a GalleryImage from a pre-rendered site image (public/images/opt/*). */
function fromSite(id: string, image: SiteImage, caption: string): GalleryImage {
  const base = image.src.replace(/^\/images\//, "").replace(/\.[a-z0-9]+$/i, "");
  const widths = WIDTHS.filter((w, i) => w <= image.width || WIDTHS[i - 1]! < image.width);
  const url = (w: number) => `/images/opt/${base}-${w}.webp`;
  return {
    id,
    alt: image.alt,
    caption,
    width: image.width,
    height: image.height,
    src: url(widths.find((w) => w >= 640) ?? widths[widths.length - 1]!),
    srcSet: widths.map((w) => `${url(w)} ${Math.min(w, image.width)}w`).join(", "),
  };
}

export function getGalleryCollections(): GalleryCollection[] {
  const photos = getGalleryImages();
  // The automated fixture build only exercises the lightbox with test patterns.
  if (process.env.PH_GALLERY_FIXTURES === "1") {
    return [
      { id: "store", title: "Test patterns", description: "Automated test build.", kind: "photo", images: photos },
    ];
  }

  return [
    {
      id: "store",
      title: "Our Store",
      description: "Genuine photographs of Pathirana Hardware on Pallama Road, Bangadeniya.",
      kind: "photo",
      images: [...photos, fromSite("shop-front", images.shopFront, "Our shop front")],
    },
    {
      id: "building-materials",
      title: "Building Materials",
      description: "Illustrations of the building materials we supply.",
      kind: "illustration",
      images: [
        fromSite("building-materials", images.buildingMaterials, "Bricks, blocks, sand and steel (illustration)"),
        fromSite("aisle-materials", images.aisleMaterials, "Building materials aisle (illustration)"),
        fromSite("plywood", images.plywood, "Plywood (illustration)"),
        fromSite("doors-windows", images.doorsWindows, "Doors & windows (illustration)"),
        fromSite("hero-materials", images.heroMaterials, "Materials and hardware (illustration)"),
      ],
    },
    {
      id: "hardware",
      title: "Hardware & Tools",
      description: "Illustrations of hardware and tool ranges.",
      kind: "illustration",
      images: [
        fromSite("store-interior", images.storeInterior, "Hardware store aisle (illustration)"),
        fromSite("tools-timber", images.toolsTimber, "Tools, fixings and timber (illustration)"),
        fromSite("tools-paint", images.toolsPaint, "Tools and paint (illustration)"),
        fromSite("plumbing", images.plumbing, "Pipes and fittings (illustration)"),
        fromSite("aisle-tools", images.aisleTools, "Hand tools and accessories (illustration)"),
        fromSite("gas-cylinders", images.gasCylinders, "Gas cylinders (illustration)"),
      ],
    },
    {
      id: "construction",
      title: "Construction",
      description: "Construction-related illustrations.",
      kind: "illustration",
      images: [
        fromSite("construction", images.heroConstruction, "Construction site (illustration)"),
        fromSite("helmet", images.hero, "Builder’s tools and safety helmet (illustration)"),
      ],
    },
  ];
}
