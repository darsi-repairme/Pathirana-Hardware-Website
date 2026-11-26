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

/**
 * Category picture, filling its (relative, sized) parent: the image staff uploaded
 * in the Admin, otherwise a forest-green icon card (no bundled artwork).
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
  if (img) {
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
