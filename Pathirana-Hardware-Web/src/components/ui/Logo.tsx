import Image from "next/image";
import { images } from "@/lib/images";

type Props = {
  /** Height utility; width follows the logo's aspect ratio. */
  className?: string;
  /** "dark" = full logo, original colours; "light" = full logo with cream lettering for dark green; "mark" = transparent symbol only. */
  tone?: "dark" | "light" | "mark";
  /** Load eagerly (header). */
  preload?: boolean;
  /** Pass an empty string when adjacent text already names the business. */
  alt?: string;
  /** Responsive sizes hint matching the rendered width. */
  sizes?: string;
};

/**
 * The ORIGINAL Pathirana Hardware logo on a transparent background (no white
 * box). The red and green brand mark is never recoloured; only on dark
 * backgrounds is the black lettering shown in cream so it stays legible.
 */
export function Logo({ className = "h-14", tone = "dark", preload = false, alt, sizes = "80px" }: Props) {
  const logo = tone === "mark" ? images.logoMark : tone === "light" ? images.logoLight : images.logo;
  return (
    <Image
      src={logo.src}
      width={logo.width}
      height={logo.height}
      alt={alt ?? logo.alt}
      sizes={sizes}
      quality={90}
      preload={preload}
      className={`w-auto ${className}`}
    />
  );
}
