import Image from "next/image";
import {
  BrickWall,
  Columns3,
  DoorOpen,
  Flame,
  Layers,
  Package,
  ShowerHead,
  Wrench,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import { images } from "@/lib/images";
import type { CategoryImage } from "@/lib/taxonomy";

const ICONS: Record<string, LucideIcon> = {
  "building-materials": BrickWall,
  "steel-products": Columns3,
  plywood: Layers,
  "doors-windows": DoorOpen,
  "bathroom-sanitary": ShowerHead,
  "gas-cylinders": Flame,
  "branded-hardware": Wrench,
};

/** A category's icon (decorative); staff-added categories use a neutral package icon. */
export function CategoryIcon({ slug, ...props }: { slug: string } & LucideProps) {
  const Icon = ICONS[slug] ?? Package;
  return <Icon aria-hidden="true" {...props} />;
}

/** Crop for each bundled category photo (Home cards, category page hero). */
const categoryCrop: Record<string, string> = {
  "building-materials": "object-[88%_88%]",
  "steel-products": "object-[78%_92%]",
  plywood: "object-[45%_60%]",
  "doors-windows": "object-[50%_55%]",
  "bathroom-sanitary": "object-[60%_55%]",
  "gas-cylinders": "object-[55%_55%]",
  "branded-hardware": "object-[30%_55%]",
};

/**
 * Category picture, filling its (relative, sized) parent:
 * a staff-uploaded image → the illustrative artwork bundled for the original
 * categories → a forest-green icon card (never a mismatched photo).
 */
export function CategoryVisual({
  category,
  sizes,
  large = false,
}: {
  category: { slug: string; image: CategoryImage | null };
  sizes: string;
  /** Always use the large icon ring. */
  large?: boolean;
}) {
  const img = category.image;
  if (img?.kind === "uploaded") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- served by the website API (no build-time image pipeline)
      <img
        src={img.src}
        srcSet={`${img.thumbSrc} 480w, ${img.src} ${img.width}w`}
        sizes={sizes}
        alt={img.alt}
        width={img.width}
        height={img.height}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 size-full object-cover"
      />
    );
  }
  if (img?.kind === "bundled") {
    const image = images[img.key];
    return (
      <Image
        src={image.src}
        alt={image.alt}
        fill
        quality={90}
        sizes={sizes}
        className={`object-cover ${categoryCrop[category.slug] ?? ""}`}
      />
    );
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_50%_45%,#16704a,var(--color-forest-900)_75%)]">
      <span
        className={`relative inline-flex items-center justify-center rounded-full border-2 border-gold-soft/70 shadow-[0_0_34px_rgb(232_190_79/0.3)] ${large ? "size-24" : "size-16 min-[520px]:size-24"}`}
      >
        <CategoryIcon
          slug={category.slug}
          strokeWidth={1.3}
          className={`text-gold-soft ${large ? "size-12" : "size-8 min-[520px]:size-12"}`}
        />
      </span>
    </div>
  );
}
