import type { Metadata, Viewport } from "next";
import {
  Inter,
  Noto_Sans_Sinhala,
  Noto_Sans_Tamil,
  Noto_Serif_Sinhala,
  Noto_Serif_Tamil,
  Playfair_Display,
} from "next/font/google";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteIntro } from "@/components/layout/SiteIntro";
import { business } from "@/content/business";
import { getSiteUrl } from "@/lib/site-url";
import { buildLocalBusinessJsonLd, serializeJsonLd } from "@/lib/structured-data";
import { createPageMetadata } from "@/lib/metadata";
import { FloatingWhatsApp } from "@/components/layout/FloatingWhatsApp";
import { I18nProvider, T } from "@/i18n/I18nProvider";
import { LOCALE_BOOT_SCRIPT } from "@/i18n/config";
import "./globals.css";

// Playfair Display (headings, preloaded) + Inter (body). next/font self-hosts
// both and generates size-adjusted fallbacks, so swapping causes no layout shift.
const display = Playfair_Display({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
  preload: true,
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  preload: false,
});

// Tamil and Sinhala (self-hosted, not preloaded): split by Unicode range, so the
// browser downloads them only when Tamil / Sinhala text is on the page.
const tamil = Noto_Sans_Tamil({ subsets: ["tamil"], variable: "--font-noto-tamil", display: "swap", preload: false });
const sinhala = Noto_Sans_Sinhala({
  subsets: ["sinhala"],
  variable: "--font-noto-sinhala",
  display: "swap",
  preload: false,
});
const tamilSerif = Noto_Serif_Tamil({
  subsets: ["tamil"],
  variable: "--font-noto-serif-tamil",
  display: "swap",
  preload: false,
});
const sinhalaSerif = Noto_Serif_Sinhala({
  subsets: ["sinhala"],
  variable: "--font-noto-serif-sinhala",
  display: "swap",
  preload: false,
});

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: siteUrl } : {}),
  title: {
    default: `${business.shortName} | Hardware Store in Bangadeniya`,
    template: `%s | ${business.shortName}, Bangadeniya`,
  },
  applicationName: business.shortName,
  ...createPageMetadata({ description: business.description, path: "/" }),
  formatDetection: { telephone: false, email: false, address: false },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0f5d3a",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-LK"
      // Next.js 16: lets Next.js switch smooth scrolling off during route
      // changes, so every new page opens at the top instantly.
      data-scroll-behavior="smooth"
      className={`${display.variable} ${sans.variable} ${tamil.variable} ${sinhala.variable} ${tamilSerif.variable} ${sinhalaSerif.variable}`}
      // SiteIntro's and the language script may add classes / lang before hydration.
      suppressHydrationWarning
    >
      <head>
        {/* Remembered language: set <html lang> and avoid a flash of English (see i18n/config.ts). */}
        <script dangerouslySetInnerHTML={{ __html: LOCALE_BOOT_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <I18nProvider>
          <SiteIntro />
          <a
            href="#main"
            className="sr-only z-50 rounded-sm bg-forest px-4 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
          >
            <T>Skip to main content</T>
          </a>
          <SiteHeader />
          <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
            {children}
          </main>
          <SiteFooter />
          <FloatingWhatsApp />
        </I18nProvider>
        <script
          type="application/ld+json"
          // Safe: static, build-time data from our own config, serialised with "<" escaped.
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildLocalBusinessJsonLd(siteUrl)) }}
        />
      </body>
    </html>
  );
}
