import { business, mailHref } from "../content/business.ts";
import { absoluteUrl, getSiteUrl } from "./site-url.ts";

/**
 * schema.org HardwareStore data built ONLY from verified details.
 * Unconfirmed fields (hours, coordinates, ratings, founding year) are omitted
 * until they are filled in src/content/business.ts.
 */
export function buildLocalBusinessJsonLd(siteUrl: URL | null = getSiteUrl()) {
  const url = absoluteUrl("/", siteUrl);
  const logo = absoluteUrl("/images/brand/logo-640.png", siteUrl);

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "HardwareStore",
    name: business.legalName,
    alternateName: business.shortName,
    slogan: business.tagline,
    description: business.description,
    telephone: business.phone.e164,
    email: mailHref.replace("mailto:", ""),
    address: {
      "@type": "PostalAddress",
      streetAddress: business.address.street,
      addressLocality: business.address.locality,
      addressCountry: business.address.countryCode,
    },
    sameAs: [
      business.social.facebook,
      business.social.instagram,
      business.social.linkedin,
      ...(business.social.tiktok.url ? [business.social.tiktok.url] : []),
    ],
  };

  if (url) {
    data["@id"] = `${url}#business`;
    data.url = url;
  }
  if (logo) {
    data.logo = logo;
    data.image = logo;
  }
  if (business.geo) {
    data.geo = { "@type": "GeoCoordinates", ...business.geo };
  }
  if (business.verifiedMapUrl) {
    data.hasMap = business.verifiedMapUrl;
  }
  if (business.foundedYear) {
    data.foundingDate = String(business.foundedYear);
  }
  return data;
}

/**
 * Serialises JSON-LD safely for embedding in a <script> tag: escapes "<" so
 * the content can never close the script element early.
 */
const BACKSLASH = String.fromCharCode(92);

export function serializeJsonLd(data: unknown): string {
  // Replace every "<" with the JSON unicode escape (backslash + u003c).
  return JSON.stringify(data).replace(/</g, `${BACKSLASH}u003c`);
}
