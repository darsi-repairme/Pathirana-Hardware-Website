/**
 * Controlled, one-time import of the images the customer website's Gallery page currently shows from
 * its own bundle (1 genuine shop photograph + the shop-front photo + 13 labelled illustrations) into
 * the Admin-managed Gallery, so staff can edit, hide, reorder or delete them like any other photo.
 *
 *   DRY RUN (default, read-only — lists what would be imported and what already exists):
 *     IMPORT_STAFF_PASSWORD=… npm run gallery:import -- --api=http://127.0.0.1:4000 --email=owner@…
 *   IMPORT (writes to the database and private storage of THAT API):
 *     IMPORT_STAFF_PASSWORD=… npm run gallery:import -- --api=… --email=… --apply --ledger=<file> [--hidden]
 *
 * Everything goes through the normal Admin API (sign-in → upload → publish): the same validation,
 * re-encoding, private storage and audit-log entries as a manual upload in the Admin. The password
 * is read from the environment only (never from the command line or logs).
 *
 *  - Idempotent: an image whose title already exists in the Gallery is SKIPPED (never duplicated),
 *    and every import is recorded by file checksum in the --ledger file, so an image imported once is
 *    never imported again (not even after staff deleted it).
 *  - Only the website's own Gallery images: no product/category art, no customer quotation photos.
 *  - Published by default (the website shows them today); --hidden imports them unpublished.
 *  - Once the Gallery has published photos, the website shows ONLY the Admin Gallery.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { flag } from "./_db";

const WEB = path.resolve(__dirname, "../../Pathirana-Hardware-Web");

type Ledger = {
  api: string;
  entries: { sha256: string; title: string; photoId: string; importedAt: string }[];
};

type Item = {
  title: string;
  altText: string;
  caption: string;
  collection: string;
  sortOrder: number;
  /** Source: a genuine photo in assets/, or a site image (largest optimised WebP in public/images/opt). */
  file: string;
};

/** Largest pre-rendered WebP of a site image (originals are not kept in the repository). */
function optimised(base: string): string {
  const dir = path.join(WEB, "public/images/opt");
  const sizes = readdirSync(dir)
    .map((f) => new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)\\.webp$`).exec(f))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => Number(m[1]))
    .sort((a, b) => b - a);
  if (!sizes.length) throw new Error(`No optimised image for ${base}`);
  return path.join(dir, `${base}-${sizes[0]}.webp`);
}

const ill = (base: string, title: string, altText: string, collection: string, sortOrder: number): Item => ({
  title,
  altText,
  caption: `${title} (illustration)`,
  collection,
  sortOrder,
  file: optimised(base),
});

const ITEMS: Item[] = [
  {
    title: "Our store",
    altText:
      "Pathirana Hardware storefront with its red signboard, glass entrance and building materials displayed outside",
    caption: "Our store",
    collection: "Our Store",
    sortOrder: 10,
    file: path.join(WEB, "assets/gallery/storefront.png"),
  },
  {
    title: "Our shop front",
    altText:
      "Pathirana Hardware shop front with its red signboard and a bright glass entrance looking into the store",
    caption: "Our shop front",
    collection: "Our Store",
    sortOrder: 20,
    file: optimised("pathirana-shop-front"),
  },
  ill(
    "gallery-building-materials",
    "Bricks, blocks, sand and steel",
    "Illustration of bricks, concrete blocks, sand, gravel, steel bars, a safety helmet and builder's tools",
    "Building Materials",
    110,
  ),
  ill(
    "pathirana-aisle-materials",
    "Building materials aisle",
    "Store aisle with pipes and fittings on shelves, paint tins, ceiling boards, bricks and concrete blocks (illustration)",
    "Building Materials",
    120,
  ),
  ill(
    "premium_plywood_showroom_display",
    "Plywood",
    "Illustration of strapped stacks of plywood sheets on a pallet beside a display of plywood panels",
    "Building Materials",
    130,
  ),
  ill(
    "forest_green_luxury_door_and_window_showroom",
    "Doors & windows",
    "Illustration of a door and window display with wooden, green and cream doors and framed sliding and casement windows",
    "Building Materials",
    140,
  ),
  ill(
    "pathirana-hero-materials",
    "Materials and hardware",
    "Hardware store interior with shelves of paint and tools, bricks, cement bags, boards and pipes (illustration)",
    "Building Materials",
    150,
  ),
  ill(
    "gallery-store-interior",
    "Hardware store aisle",
    "Illustration of a hardware store aisle with hand tools and tool boxes on the left and paint, sealants and pipes on the right",
    "Hardware & Tools",
    210,
  ),
  ill(
    "gallery-tools-hardware",
    "Tools, fixings and timber",
    "Illustration of power drills, hand tools, screws and bolts on a workbench beside timber and steel sections",
    "Hardware & Tools",
    220,
  ),
  ill(
    "pathirana-tools-paint",
    "Tools and paint",
    "Paint tins, paint brushes, a roller tray, a cordless drill, a tape measure and bolts on a counter (illustration)",
    "Hardware & Tools",
    230,
  ),
  ill(
    "pathirana-plumbing",
    "Pipes and fittings",
    "Grey and white PVC pipes, elbows, brass valves and pipe clamps displayed on a counter (illustration)",
    "Hardware & Tools",
    240,
  ),
  ill(
    "pathirana-aisle-tools",
    "Hand tools and accessories",
    "Store aisle with hand tools, tool boxes and hoses on the left and paint tins on the right (illustration)",
    "Hardware & Tools",
    250,
  ),
  ill(
    "premium_green_and_gold_gas_cylinder_display",
    "Gas cylinders",
    "Illustration of green and yellow gas cylinders of different sizes on a display counter",
    "Hardware & Tools",
    260,
  ),
  ill(
    "pathirana-hero-construction",
    "Construction site",
    "A building under construction with scaffolding, a yellow excavator, steel bars and concrete blocks on site (illustration)",
    "Construction",
    310,
  ),
  ill(
    "pathirana-hero-helmet-banner",
    "Builder’s tools and safety helmet",
    "Yellow safety helmet with the Pathirana Hardware mark, resting on bricks beside a trowel, tape measure, spirit level, hammer and work gloves (illustration)",
    "Construction",
    320,
  ),
];

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

async function main() {
  const api = (flag("api") ?? "").replace(/\/+$/, "");
  const email = flag("email");
  const password = process.env.IMPORT_STAFF_PASSWORD;
  const apply = process.argv.includes("--apply");
  const hidden = process.argv.includes("--hidden");
  if (!/^https?:\/\//.test(api))
    throw new Error("--api=<API base URL> is required, e.g. --api=http://127.0.0.1:4000");

  for (const it of ITEMS) if (!existsSync(it.file)) throw new Error(`Missing source file: ${it.file}`);
  console.log(`${apply ? "IMPORT" : "DRY RUN (nothing is written)"} → ${api}`);

  let existing: { title: string }[] = [];
  let token: string | null = null;
  if (email && password) {
    const r = await fetch(`${api}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) throw new Error(`Sign-in failed (HTTP ${r.status}).`);
    token = ((await r.json()) as { accessToken: string }).accessToken;
    const g = await fetch(`${api}/api/v1/admin/gallery`, { headers: { Authorization: `Bearer ${token}` } });
    if (!g.ok) throw new Error(`Could not read the Gallery (HTTP ${g.status}).`);
    existing = (await g.json()) as { title: string }[];
    console.log(`Gallery now holds ${existing.length} photo(s).`);
  } else if (apply) {
    throw new Error("--apply needs --email=<staff email> and IMPORT_STAFF_PASSWORD in the environment.");
  } else {
    console.log("(No sign-in given: existing Gallery titles were not checked.)");
  }
  const have = new Set(existing.map((e) => e.title.trim().toLowerCase()));

  // Ledger of earlier imports to THIS API (source checksum → Gallery photo): an image imported before
  // is never imported again, even if staff deleted it afterwards.
  const ledgerFile = flag("ledger");
  if (apply && !ledgerFile) throw new Error("--apply needs --ledger=<file> (the record of imported images).");
  const ledger: Ledger =
    ledgerFile && existsSync(ledgerFile)
      ? (JSON.parse(readFileSync(ledgerFile, "utf8")) as Ledger)
      : { api, entries: [] };
  if (ledger.api !== api) throw new Error(`The ledger belongs to ${ledger.api}, not ${api}.`);
  const imported = new Map(ledger.entries.map((e) => [e.sha256, e]));

  let added = 0;
  let skipped = 0;
  for (const it of ITEMS) {
    const bytes = readFileSync(it.file);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const label = `${it.collection} / ${it.title} (${path.basename(it.file)}, ${(bytes.length / 1024).toFixed(0)} KB, sha256 ${sha256.slice(0, 12)}…)`;
    const before = imported.get(sha256);
    if (before) {
      console.log(
        `  SKIP (imported before on ${before.importedAt.slice(0, 10)}; never re-imported)  ${label}`,
      );
      skipped++;
      continue;
    }
    if (have.has(it.title.toLowerCase())) {
      console.log(`  SKIP (a Gallery photo with this title already exists)  ${label}`);
      skipped++;
      continue;
    }
    if (!apply) {
      console.log(`  WOULD IMPORT${hidden ? " (hidden)" : " (published)"}  ${label}`);
      continue;
    }
    const form = new FormData();
    form.append("title", it.title);
    form.append("altText", it.altText);
    form.append("caption", it.caption);
    form.append("collection", it.collection);
    form.append("sortOrder", String(it.sortOrder));
    form.append(
      "file",
      new Blob([readFileSync(it.file)], { type: MIME[path.extname(it.file).toLowerCase()] }),
      path.basename(it.file),
    );
    const up = await fetch(`${api}/api/v1/admin/gallery`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token!}` },
      body: form,
    });
    if (!up.ok) throw new Error(`Upload failed for "${it.title}" (HTTP ${up.status}): ${await up.text()}`);
    const photo = (await up.json()) as { id: string };
    if (!hidden) {
      const pub = await fetch(`${api}/api/v1/admin/gallery/${photo.id}/publication`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token!}`, "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: true }),
      });
      if (!pub.ok) throw new Error(`Publishing failed for "${it.title}" (HTTP ${pub.status}).`);
    }
    ledger.entries.push({ sha256, title: it.title, photoId: photo.id, importedAt: new Date().toISOString() });
    writeFileSync(ledgerFile!, JSON.stringify(ledger, null, 2));
    console.log(`  IMPORTED${hidden ? " (hidden)" : " (published)"}  ${label}`);
    added++;
  }
  console.log(
    apply
      ? `Done: ${added} imported, ${skipped} skipped (already present).`
      : `Dry run: ${ITEMS.length - skipped} would be imported, ${skipped} already present.`,
  );
}

main().catch((e: Error) => {
  console.error(e.message);
  process.exit(1);
});
