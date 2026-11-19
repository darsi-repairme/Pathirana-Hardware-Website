export type NavItem = { label: string; href: string };

/** Primary site navigation — used by the header and mobile menu. */
export const mainNav: readonly NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Products", href: "/products/" },
  { label: "Services", href: "/services/" },
  { label: "About Us", href: "/about/" },
  { label: "Contact Us", href: "/contact/" },
];

/** Footer quick links — the main navigation plus the Gallery and FAQ pages. */
export const footerNav: readonly NavItem[] = [
  ...mainNav.slice(0, 4),
  { label: "Gallery", href: "/gallery/" },
  mainNav[4]!,
  { label: "FAQ", href: "/faq/" },
  { label: "Request a Quotation", href: "/quotation/" },
];

/** Legal pages (footer bottom bar). Drafts awaiting owner review — not in the sitemap. */
export const legalNav: readonly NavItem[] = [
  { label: "Privacy Policy", href: "/privacy-policy/" },
  { label: "Refund Policy", href: "/refund-policy/" },
  { label: "Terms and Conditions", href: "/terms-and-conditions/" },
];

/** Every top-level public page (sitemap). Detail pages are added in app/sitemap.ts. */
export const allPages: readonly NavItem[] = footerNav;
