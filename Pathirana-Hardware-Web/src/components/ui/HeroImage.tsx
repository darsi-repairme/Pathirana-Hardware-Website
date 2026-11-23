import Image from "next/image";

type Img = { src: string; alt: string; width: number; height: number };

/**
 * Framed image for the PageHero media slot: rounded, offset gold outline,
 * soft shadow. `note` adds a small honest label (e.g. "Illustration").
 */
export function HeroImage({
  image,
  sizes = "(min-width: 1440px) 520px, (min-width: 1024px) 36vw, 100vw",
  crop = "",
  aspect = "aspect-[4/3]",
  note,
  preload = true,
}: {
  image: Img;
  sizes?: string;
  crop?: string;
  aspect?: string;
  note?: string;
  preload?: boolean;
}) {
  return (
    <figure className="relative mx-auto w-full max-w-xl pr-3 pb-3 lg:max-w-none land:max-w-none">
      <div
        aria-hidden="true"
        className="absolute top-3 right-0 bottom-0 left-3 rounded-[1.75rem] border-2 border-gold-soft/50"
      />
      <div className={`relative ${aspect} overflow-hidden rounded-[1.75rem] bg-forest-900 shadow-[var(--shadow-lift)]`}>
        <Image
          src={image.src}
          alt={image.alt}
          fill
          quality={90}
          sizes={sizes}
          preload={preload}
          className={`object-cover ${crop}`}
        />
        <span aria-hidden="true" className="absolute inset-0 rounded-[1.75rem] ring-1 ring-white/15 ring-inset" />
      </div>
      {note ? (
        <figcaption className="absolute bottom-6 left-4 rounded-full bg-forest-900/85 px-3 py-1 text-xs font-medium text-cream/90 backdrop-blur-sm">
          {note}
        </figcaption>
      ) : null}
    </figure>
  );
}
