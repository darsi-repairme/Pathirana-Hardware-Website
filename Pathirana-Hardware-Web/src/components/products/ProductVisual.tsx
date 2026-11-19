import Image from "next/image";
import {
  Bath,
  BrickWall,
  Columns3,
  DoorOpen,
  Flame,
  Grid2x2,
  Layers,
  SquareStack,
  type LucideIcon,
} from "lucide-react";
import type { ProductType } from "@/content/products";
import { images } from "@/lib/images";

export const productTypeIcon: Record<string, LucideIcon> = {
  cement: BrickWall,
  "tor-bars": Columns3,
  plywood: Layers,
  "box-bars": SquareStack,
  doors: DoorOpen,
  windows: Grid2x2,
  "bathroom-sets": Bath,
  "gas-cylinders": Flame,
};

/** Forest-green icon panel used when no genuinely matching image exists. */
export function IconPanel({ icon: Icon, size = "md" }: { icon: LucideIcon; size?: "md" | "lg" }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_50%_45%,#16704a,var(--color-forest-900)_75%)]">
      <span
        className={`relative inline-flex items-center justify-center rounded-full border-2 border-gold-soft/70 shadow-[0_0_34px_rgb(232_190_79/0.3)] ${size === "lg" ? "size-32 sm:size-40" : "size-20 sm:size-24"}`}
      >
        <Icon
          aria-hidden="true"
          strokeWidth={1.3}
          className={`text-gold-soft ${size === "lg" ? "size-16 sm:size-20" : "size-10 sm:size-12"}`}
        />
      </span>
    </div>
  );
}

/** Product-type picture (illustrative artwork) or icon panel. Fills its sized, relative parent. */
export function ProductTypeVisual({
  product,
  sizes,
  size = "md",
  preload = false,
  decorative = false,
}: {
  product: ProductType;
  sizes: string;
  size?: "md" | "lg";
  preload?: boolean;
  /** Empty alt when the name is already next to the image. */
  decorative?: boolean;
}) {
  if (product.image) {
    const image = images[product.image];
    return (
      <Image
        src={image.src}
        alt={decorative ? "" : image.alt}
        fill
        quality={90}
        sizes={sizes}
        preload={preload}
        className={`object-cover ${product.crop ?? ""}`}
      />
    );
  }
  return <IconPanel icon={productTypeIcon[product.slug] ?? Layers} size={size} />;
}
