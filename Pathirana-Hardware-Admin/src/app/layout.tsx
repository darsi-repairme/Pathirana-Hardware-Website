import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

// Same typefaces as the public website: Playfair Display (headings) + Inter (body).
const display = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Staff Admin · Pathirana Hardware", template: "%s · Pathirana Hardware Admin" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#072e1d" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
