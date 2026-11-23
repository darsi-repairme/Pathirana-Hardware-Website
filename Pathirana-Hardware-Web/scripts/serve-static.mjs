/**
 * Minimal static file server for previewing and testing the exported site.
 * Behaves like a typical static host:
 *  - "/about"  → 308 redirect to "/about/"
 *  - "/about/" → about/index.html
 *  - unknown   → 404.html with HTTP 404
 *  - applies the security headers generated in <dir>/_headers
 *
 * Usage: node scripts/serve-static.mjs [dir=out] [port=4173]
 * Not intended for production use — deploy the `out` folder to a real host.
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { brotliCompressSync, gzipSync, constants as zc } from "node:zlib";

const root = path.resolve(process.argv[2] || "out");
const port = Number(process.argv[3] || process.env.PORT || 4173);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

async function loadHeaders() {
  try {
    const text = await readFile(path.join(root, "_headers"), "utf8");
    const block = text.split(/\n\s*\n/)[0] ?? "";
    const out = {};
    for (const line of block.split("\n").slice(1)) {
      const m = line.match(/^\s+([^:]+):\s*(.*)$/);
      if (!m) continue;
      const [, k, v] = m;
      if (k === "Strict-Transport-Security") continue; // local HTTP only
      // Local server is plain HTTP; upgrading would break localhost.
      out[k] = k === "Content-Security-Policy" ? v.replace(/;\s*upgrade-insecure-requests/, "") : v;
    }
    return out;
  } catch {
    return {};
  }
}
// Read per request (small file): a rebuild changes the CSP script hashes, and a
// preview that cached them at start-up would block the newly built scripts.
let securityHeaders = await loadHeaders();

async function isFile(p) {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
}

const server = createServer(async (req, res) => {
  try {
    securityHeaders = await loadHeaders();
    const url = new URL(req.url || "/", "http://localhost");
    let pathname = decodeURIComponent(url.pathname);
    const target = path.resolve(root, "." + pathname);
    if (!target.startsWith(root)) {
      res.writeHead(400).end("Bad request");
      return;
    }

    let file = target;
    if (pathname.endsWith("/")) file = path.join(target, "index.html");
    else if (!(await isFile(file)) && (await isFile(path.join(target, "index.html")))) {
      res.writeHead(308, { Location: pathname + "/" + url.search, ...securityHeaders }).end();
      return;
    }

    let status = 200;
    if (!(await isFile(file))) {
      status = 404;
      file = path.join(root, "404.html");
    }
    let body = await readFile(file);
    const type = TYPES[path.extname(file)] || "application/octet-stream";
    const extra = {};
    // Compress text responses like real static hosts do.
    if (/text|javascript|json|xml|svg/.test(type)) {
      const accept = String(req.headers["accept-encoding"] || "");
      if (accept.includes("br")) {
        body = brotliCompressSync(body, { params: { [zc.BROTLI_PARAM_QUALITY]: 9 } });
        extra["Content-Encoding"] = "br";
      } else if (accept.includes("gzip")) {
        body = gzipSync(body);
        extra["Content-Encoding"] = "gzip";
      }
      extra["Vary"] = "Accept-Encoding";
    }
    res.writeHead(status, { "Content-Type": type, ...extra, ...securityHeaders });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch (err) {
    res.writeHead(500).end("Server error");
    console.error(err);
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Serving ${root} at http://127.0.0.1:${port}`);
});
