/**
 * Post-build step for the static export.
 *
 * 1. Computes SHA-256 hashes of every inline <script> Next.js emitted, so the
 *    Content-Security-Policy can allow exactly those scripts — no
 *    'unsafe-inline' for scripts.
 * 2. Writes hosting-layer security headers for common static hosts:
 *      out/_headers   → Netlify, Cloudflare Pages
 *      out/.htaccess  → Apache / cPanel shared hosting
 *    (nginx / other hosts: see README → Deployment.)
 * 3. Writes build-reports/security-headers.json for reference.
 * 4. Warns if NEXT_PUBLIC_SITE_URL is not set.
 */
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, process.env.PH_DIST_DIR || "out");

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

// ── 0. Fix Windows segment-prefetch filenames ───────────────────────────────
// Next.js 16.4 builds on Windows write prefetch files as
//   about/__next.about/__PAGE__.txt
// while the client requests
//   about/__next.about.__PAGE__.txt
// (the exporter only converts "/" separators, not "\"). Flatten them so client
// navigation prefetches do not 404. On Linux/macOS builds this is a no-op.
async function flattenSegmentDirs(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("__next.")) {
      for await (const file of walk(full)) {
        const rel = path.relative(full, file).split(path.sep).join(".");
        await rename(file, path.join(dir, `${entry.name}.${rel}`));
      }
      await rm(full, { recursive: true, force: true });
      flattened++;
    } else {
      await flattenSegmentDirs(full);
    }
  }
}
let flattened = 0;
await flattenSegmentDirs(outDir);
if (flattened) console.log(`postbuild: flattened ${flattened} segment-prefetch folder(s) (Windows export workaround).`);

// ── 1. Inline script hashes ──────────────────────────────────────────────────
const hashes = new Set();
const styleHashes = new Set();
// Inline style ATTRIBUTES (next/image writes e.g. style="color:transparent").
const attrHashes = new Set();
const STYLE_ATTR_RE = new RegExp(' style="([^"]*)"', "g");
const decodeEntities = (v) =>
  v
    .replace(/&quot;/g, String.fromCharCode(34))
    .replace(/&#x27;|&#39;/g, String.fromCharCode(39))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
const STYLE_RE = new RegExp("<style[^>]*>([^]*?)</style>", "gi");
let htmlCount = 0;
const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

for await (const file of walk(outDir)) {
  if (!file.endsWith(".html")) continue;
  htmlCount++;
  const html = await readFile(file, "utf8");
  for (const [, value] of html.matchAll(STYLE_ATTR_RE)) {
    attrHashes.add(`'sha256-${createHash("sha256").update(decodeEntities(value), "utf8").digest("base64")}'`);
  }
  for (const [, css] of html.matchAll(STYLE_RE)) {
    if (css) styleHashes.add(`'sha256-${createHash("sha256").update(css, "utf8").digest("base64")}'`);
  }
  for (const [, attrs, body] of html.matchAll(SCRIPT_RE)) {
    if (/\bsrc\s*=/.test(attrs)) continue; // external file → covered by 'self'
    if (/type\s*=\s*["']application\/ld\+json["']/i.test(attrs)) continue; // data block, never executed
    if (!body) continue;
    hashes.add(`'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`);
  }
}

if (htmlCount === 0) {
  console.error(`postbuild: no HTML found in ${outDir}. Did the build run?`);
  process.exit(1);
}

// ── 2. Security headers ─────────────────────────────────────────────────────
// The website API (delivery areas, product catalogue and its published product
// images) is the only other origin the browser may use, and only when
// NEXT_PUBLIC_API_URL is configured at build time.
let apiOrigin = "";
if (process.env.NEXT_PUBLIC_API_URL) {
  try {
    const u = new URL(process.env.NEXT_PUBLIC_API_URL);
    if (u.protocol === "https:" || u.protocol === "http:") apiOrigin = u.origin;
  } catch {
    console.warn("⚠  NEXT_PUBLIC_API_URL is not a valid URL; the API origin was not added to connect-src.");
  }
}
const csp = [
  "default-src 'self'",
  `script-src 'self' ${[...hashes].sort().join(" ")}`,
  `style-src 'self' ${[...styleHashes].sort().join(" ")}`.trim(),
  ...(attrHashes.size ? [`style-src-attr 'unsafe-hashes' ${[...attrHashes].sort().join(" ")}`] : []),
  // blob: = local previews of the photos a customer picks in the quotation form (never uploaded content).
  `img-src 'self' data: blob:${apiOrigin ? ` ${apiOrigin}` : ""}`,
  "font-src 'self'",
  `connect-src 'self'${apiOrigin ? ` ${apiOrigin}` : ""}`,
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const headers = {
  "Content-Security-Policy": csp,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};
// HSTS is only meaningful over HTTPS; hosts below send it on HTTPS responses.
const HSTS = "max-age=31536000";

// Netlify / Cloudflare Pages
const netlify =
  [
    "/*",
    ...Object.entries(headers).map(([k, v]) => `  ${k}: ${v}`),
    `  Strict-Transport-Security: ${HSTS}`,
    "",
    "/_next/static/*",
    "  Cache-Control: public, max-age=31536000, immutable",
    "",
    "/images/*",
    "  Cache-Control: public, max-age=604800",
  ].join("\n") + "\n";
await writeFile(path.join(outDir, "_headers"), netlify);

// Apache (.htaccess)
const esc = (v) => v.replace(/"/g, '\\"');
const htaccess = `# Generated by scripts/postbuild.mjs — do not edit by hand.
Options -Indexes
DirectoryIndex index.html
ErrorDocument 404 /404.html

<IfModule mod_rewrite.c>
  RewriteEngine On
  # Redirect HTTP to HTTPS (enable once an SSL certificate is installed).
  # RewriteCond %{HTTPS} !=on
  # RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</IfModule>

<IfModule mod_headers.c>
${Object.entries(headers)
  .map(([k, v]) => `  Header always set ${k} "${esc(v)}"`)
  .join("\n")}
  Header always set Strict-Transport-Security "${HSTS}" env=HTTPS
  <FilesMatch "\\.(js|css|woff2)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
</IfModule>

<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css text/plain text/javascript application/javascript application/json application/xml image/svg+xml
</IfModule>

<IfModule mod_mime.c>
  AddType text/plain .txt
  AddType font/woff2 .woff2
  AddType image/webp .webp
</IfModule>
`;
await writeFile(path.join(outDir, ".htaccess"), htaccess);

// Reference copy (not published)
await mkdir(path.join(root, "build-reports"), { recursive: true });
await writeFile(
  path.join(root, "build-reports/security-headers.json"),
  JSON.stringify({ ...headers, "Strict-Transport-Security": HSTS }, null, 2) + "\n",
);

console.log(
  `postbuild: ${htmlCount} HTML files, ${hashes.size} inline script hashes, ${styleHashes.size} inline style hashes, ${attrHashes.size} style-attribute hashes → _headers, .htaccess written.`,
);

// ── 4. Domain reminder ───────────────────────────────────────────────────────
if (!process.env.NEXT_PUBLIC_SITE_URL) {
  console.warn(
    "\n⚠  NEXT_PUBLIC_SITE_URL is not set. Canonical URLs, sitemap entries and social-share image URLs were omitted.\n" +
      "   Set it to the confirmed domain before the production build, e.g.\n" +
      "   NEXT_PUBLIC_SITE_URL=https://www.your-domain.lk npm run build\n",
  );
}
