/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  PATHIRANA HARDWARE — CENTRAL BUSINESS CONFIGURATION
 * ─────────────────────────────────────────────────────────────────────────────
 *  Every business fact shown on the website comes from this file.
 *
 *  RULES
 *  • Only enter information the owner has confirmed.
 *  • Fields set to `null` are NOT shown anywhere on the website. When the owner
 *    confirms a detail, fill it in here and it will appear automatically
 *    (contact page, footer, structured data for search engines, etc.).
 *  • Never add placeholder phone numbers, invented hours or sample reviews.
 *
 *  This file must not import anything — it is also used by the unit tests.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type OpeningHoursEntry = {
  /** e.g. "Monday – Saturday" */
  days: string;
  /** e.g. "8.00 am – 6.00 pm" or "Closed" */
  hours: string;
};

export type BusinessConfig = {
  legalName: string;
  shortName: string;
  tagline: string;
  /** Short, factual description used for SEO and social sharing. */
  description: string;
  address: {
    lines: readonly string[];
    street: string;
    locality: string;
    country: string;
    countryCode: string;
  };
  phone: {
    /** As written locally, for display. */
    display: string;
    /** International display format. */
    international: string;
    /** E.164 format, used in tel: links. */
    e164: string;
  };
  email: string;
  social: {
    facebook: string;
    /** Official profile links supplied by the client (Follow Us icons). */
    instagram: string;
    linkedin: string;
    tiktok: { handle: string; url: string | null };
  };
  /** Services listed on the Facebook page — details still to be confirmed. */
  servicesListedOnFacebook: readonly string[];

  // ── Unconfirmed details (keep null until the owner confirms) ──────────────
  /** Verified opening hours. `null` = hidden. */
  openingHours: readonly OpeningHoursEntry[] | null;
  /** WhatsApp number in E.164 format (e.g. "+9471…"). `null` = no WhatsApp button.
   *  Confirmed by the client: WhatsApp uses the same number as the phone line. */
  whatsappE164: string | null;
  /** Owner-verified Google Maps place link (e.g. https://maps.app.goo.gl/…). */
  verifiedMapUrl: string | null;
  /** Owner-verified coordinates for structured data. */
  geo: { latitude: number; longitude: number } | null;
  /** Year the business was established. */
  foundedYear: number | null;
  /** Full establishment date as confirmed by the client. */
  foundedDate: string;
  /** Current owner, as confirmed by the client. */
  owner: string;
};

export const business: BusinessConfig = {
  /** Legal company name — internal records and structured data only; never shown as the display name. */
  legalName: "Pathirana Hardware (Pvt) Ltd.",
  shortName: "Pathirana Hardware",
  tagline: "Shop smarter, save bigger!",
  description:
    "Pathirana Hardware is a hardware store on Pallama Road, Bangadeniya, Sri Lanka. Call or email to ask about hardware and building supplies.",
  address: {
    lines: ["Pathirana Hardware", "Pallama Road", "Bangadeniya", "Sri Lanka"],
    street: "Pallama Road",
    locality: "Bangadeniya",
    country: "Sri Lanka",
    countryCode: "LK",
  },
  phone: {
    display: "071 225 9699",
    international: "+94 71 225 9699",
    e164: "+94712259699",
  },
  email: "pathiranahardwarepvt@gmail.com",
  social: {
    facebook: "https://www.facebook.com/p/Pathirana-Hardware-100054510037278/",
    // Links exactly as supplied by the client.
    instagram: "https://www.instagram.com/pathiranahardware?exln=MWw0OWdpdTV2djI4eA==",
    linkedin: "https://www.linkedin.com/in/pathirana-hardwere-pvt-ltd-a6826943a",
    tiktok: {
      handle: "pathiranahardwar",
      url: "https://www.tiktok.com/@pathiranahardwar?_r=1&_t=ZS-9BLldMwKUGl",
    },
  },
  servicesListedOnFacebook: ["Delivery", "Reservations"],

  // Client-confirmed (2026-11-20). Public holidays may differ — no special schedule is invented.
  openingHours: [
    { days: "Monday – Saturday", hours: "7:30 AM – 7:00 PM" },
    { days: "Sunday", hours: "Closed" },
  ],
  whatsappE164: "+94712259699",
  verifiedMapUrl: null,
  geo: null,
  foundedYear: 1997,
  foundedDate: "16 April 1997",
  owner: "Oshada Warshan Pathirana",
};

// ── Derived links (do not edit) ─────────────────────────────────────────────

export const telHref = `tel:${business.phone.e164}`;
export const mailHref = `mailto:${business.email}`;

/** Single-line address, e.g. for map searches. */
export const addressOneLine = business.address.lines.join(", ");

/**
 * Google Maps link. Uses the owner-verified place link when available;
 * otherwise an address *search* (clearly labelled as a search in the UI).
 */
export const mapsHref =
  business.verifiedMapUrl ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressOneLine)}`;

export const mapsIsVerifiedPin = business.verifiedMapUrl !== null;

export const whatsappHref = business.whatsappE164 ? `https://wa.me/${business.whatsappE164.replace(/\D/g, "")}` : null;

/**
 * WhatsApp chat link (navbar, footer, contact actions). The client confirmed
 * WhatsApp uses the same number as the phone line (071 225 9699).
 */
export const whatsappChatHref = `https://wa.me/${(business.whatsappE164 ?? business.phone.e164).replace(/\D/g, "")}`;

/**
 * WhatsApp chat with a pre-filled enquiry about a real product category or
 * service name, e.g. whatsappEnquiryHref("Plywood"). The text is URL-encoded.
 * (A normal chat link — no automated replies or ordering system.)
 */
export function whatsappEnquiryHref(subject: string, locale: "en" | "ta" | "si" = "en"): string {
  // Tamil / Sinhala: faithful versions of the English wording (pending native-speaker review).
  const text =
    locale === "ta"
      ? `வணக்கம் Pathirana Hardware, ${subject} பற்றி விசாரிக்க விரும்புகிறேன்.`
      : locale === "si"
        ? `ආයුබෝවන් Pathirana Hardware, ${subject} ගැන විමසීමට කැමැත්තෙමි.`
        : `Hello Pathirana Hardware, I would like to enquire about ${subject}.`;
  return `${whatsappChatHref}?text=${encodeURIComponent(text)}`;
}

// Product-specific enquiries (cards, product pages, search results) all use the
// shared generator in src/lib/product-enquiry.ts.
