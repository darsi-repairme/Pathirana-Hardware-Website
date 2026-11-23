/**
 * The production domain has not been confirmed yet.
 *
 * Set NEXT_PUBLIC_SITE_URL (e.g. "https://www.example.lk") at build time once
 * the domain is known. Until then, canonical URLs, sitemap entries and absolute
 * social-image URLs are omitted rather than published with a wrong domain.
 */
export function getSiteUrl(raw: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): URL | null {
  if (!raw || !raw.trim()) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    // Normalise: no trailing slash on the origin/base path.
    url.pathname = url.pathname.replace(/\/+$/, "");
    url.search = "";
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

/** Absolute URL for a site path, or null when the domain is not configured. */
export function absoluteUrl(path: string, base: URL | null = getSiteUrl()): string | null {
  if (!base) return null;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  // URL normalises an empty pathname to "/", so strip trailing slashes here.
  const basePath = base.pathname.replace(/\/+$/, "");
  return `${base.origin}${basePath}${cleanPath}`;
}
