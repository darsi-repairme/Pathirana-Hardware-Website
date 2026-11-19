import Image from "next/image";
import { business } from "@/content/business";
import { images } from "@/lib/images";

/** The Pathirana Hardware storefront photograph in a premium rounded frame. */
export function ShopPhoto({ sizes, preload = false }: { sizes: string; preload?: boolean }) {
  return (
    <figure className="group relative">
      <div
        aria-hidden="true"
        className="absolute inset-0 translate-x-3 translate-y-3 rounded-[1.75rem] border-2 border-brass/60 sm:translate-x-4 sm:translate-y-4"
      />
      <div className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] bg-cream-deep shadow-[var(--shadow-lift)]">
        <Image
          src={images.shop.src}
          alt={images.shop.alt}
          fill
          quality={90}
          sizes={sizes}
          preload={preload}
          className="object-cover transition-transform duration-[1200ms] ease-[var(--ease-out-soft)] group-hover:scale-[1.04] motion-reduce:transition-none"
        />
      </div>
      <figcaption className="absolute -bottom-5 left-5 rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-lift)] sm:left-8">
        <span aria-hidden="true" className="text-gold-soft">
          ●
        </span>{" "}
        {business.address.street}, {business.address.locality}
      </figcaption>
    </figure>
  );
}
