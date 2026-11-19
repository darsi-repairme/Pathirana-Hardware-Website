import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteIntro } from "@/components/layout/SiteIntro";
import { business } from "@/content/business";
import { getSiteUrl } from "@/lib/site-url";
import { buildLocalBusinessJsonLd, serializeJsonLd } from "@/lib/structured-data";
import { createPageMetadata } from "@/lib/metadata";
import { FloatingWhatsApp } from "@/components/layout/FloatingWhatsApp";
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

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: siteUrl } : {}),
  title: {
    default: `${business.legalName} | Hardware Store in Bangadeniya`,
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
      className={`${display.variable} ${sans.variable}`}
      // SiteIntro's inline script may add "intro-seen" before hydration.
      suppressHydrationWarning
    >
      <body className="flex min-h-dvh flex-col">
        <SiteIntro />
        <a
          href="#main"
          className="sr-only z-50 rounded-sm bg-forest px-4 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to main content
        </a>
        <SiteHeader />
        <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <SiteFooter />
        <FloatingWhatsApp />
        <script
          type="application/ld+json"
          // Safe: static, build-time data from our own config, serialised with "<" escaped.
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildLocalBusinessJsonLd(siteUrl)) }}
        />
      </body>
    </html>
  );
}
