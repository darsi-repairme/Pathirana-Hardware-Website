/**
 * Starter catalogue from the shop's Excel item report (scripts/data/starter-catalogue-2026-11-19.json):
 * 5 categories, 5 brands (reused when they exist) and 15 products with their item codes and initial
 * LKR prices. Run BY HAND only — never at server start-up.
 *
 *   DRY RUN (default, read-only):  npm run seed:starter -- --env-file=.env.supabase
 *   APPLY:                          npm run seed:starter -- --env-file=.env.supabase --apply \
 *                                     --confirm-database=NAME --backup-dir=<folder>
 *
 * Rules
 *  - Insert-only: an existing category (same slug), brand (same name ignoring case, spaces, hyphens
 *    and accents, or same slug) or product (same item code or slug) is REUSED, never modified — staff
 *    edits, logos and images are left exactly as they are.
 *  - Deleted stays deleted: every record this seed creates is recorded in the audit log
 *    (action "catalogue.seed", details.source). If such a record was later removed by staff, a re-run
 *    SKIPS it instead of re-creating it.
 *  - Draft first: new categories and brands are created HIDDEN and new products UNPUBLISHED, so nothing
 *    appears on the website until the owner reviews prices and details and publishes.
 *  - Prices are the report's Cash Price (initial, owner to confirm); availability "On Request" (no stock
 *    figures are claimed); no images, logos, discounts or stock quantities are created.
 *  - The Excel item code is kept as a search term "item <code>" (searchable in the Admin) and, with the
 *    raw Excel name, in the audit log details.
 *  - --apply first writes a verified JSON backup of the catalogue tables to --backup-dir, then writes
 *    everything in ONE transaction (all or nothing).
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Client } from "pg";
import { connect, databaseUrl, describe, flag, requireConfirmation } from "./_db";

type Locale = { name: string; description: string };
type Data = {
  source: string;
  translationsNeedReview: boolean;
  categories: {
    slug: string;
    name: string;
    sourceDepartment: string;
    sortOrder: number;
    description: string;
    translations: { ta: Locale; si: Locale };
  }[];
  brands: { slug: string; name: string }[];
  products: {
    code: string;
    rawName: string;
    name: string;
    slug: string;
    category: string;
    brand: string | null;
    priceLkr: string;
    unit: string | null;
    summary: string;
    sourceNote?: string;
  }[];
};

const DATA_FILE = path.resolve(__dirname, "data/starter-catalogue-2026-11-19.json");
const data = JSON.parse(readFileSync(DATA_FILE, "utf8")) as Data;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** "S-Lon", "slon", "S Lon", "Würth"/"Wurth" → the same key. */
const norm = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const codeTerm = (code: string) => `item ${code}`;

function validate() {
  const errs: string[] = [];
  const cats = new Set(data.categories.map((c) => c.slug));
  const brands = new Set(data.brands.map((b) => b.slug));
  for (const c of data.categories) {
    if (!SLUG.test(c.slug) || c.name.length > 120 || c.description.length > 2000)
      errs.push(`category ${c.slug}`);
  }
  const codes = new Set<string>();
  for (const p of data.products) {
    if (!SLUG.test(p.slug) || p.slug.length > 80) errs.push(`product slug ${p.slug}`);
    if (p.name.length > 160 || p.summary.length > 300) errs.push(`product text ${p.code}`);
    if (!/^\d+\.\d{2}$/.test(p.priceLkr)) errs.push(`price ${p.code}`);
    if (!cats.has(p.category)) errs.push(`category of ${p.code}`);
    if (p.brand && !brands.has(p.brand)) errs.push(`brand of ${p.code}`);
    if (codes.has(p.code)) errs.push(`duplicate code ${p.code}`);
    codes.add(p.code);
    if (codeTerm(p.code).length > 60) errs.push(`code ${p.code}`);
  }
  if (errs.length) throw new Error(`Invalid seed data: ${errs.join(", ")}`);
}

async function backup(c: Client, dir: string) {
  mkdirSync(dir, { recursive: true });
  const sums: string[] = [];
  for (const t of ["categories", "brands", "products", "product_brands"]) {
    const rows = (await c.query(`SELECT to_jsonb(x) AS j FROM ${t} x ORDER BY 1`)).rows.map((r) => r.j);
    const json = JSON.stringify(rows, null, 1);
    writeFileSync(path.join(dir, `${t}.json`), json);
    sums.push(`${createHash("sha256").update(json).digest("hex")}  ${t}.json`);
  }
  writeFileSync(path.join(dir, "SHA256SUMS"), sums.join("\n") + "\n");
  for (const line of sums) {
    const [sum, file] = line.split("  ");
    if (
      createHash("sha256")
        .update(readFileSync(path.join(dir, file!)))
        .digest("hex") !== sum
    )
      throw new Error(`Backup verification failed for ${file}`);
  }
  return sums.length;
}

async function main() {
  validate();
  const apply = process.argv.includes("--apply");
  const url = databaseUrl();
  if (apply) requireConfirmation(url);
  const backupDir = flag("backup-dir");
  if (apply && !backupDir) throw new Error("--apply needs --backup-dir=<folder> (a backup is taken first).");
  console.log(`${apply ? "APPLY" : "DRY RUN (read-only)"} → ${describe(url)}`);
  const c = await connect(url);
  try {
    await c.query(apply ? "BEGIN" : "BEGIN READ ONLY");
    if (apply) {
      // One seeding run at a time.
      await c.query("SELECT pg_advisory_xact_lock(774211002)");
      console.log(`Backup: ${await backup(c, backupDir!)} tables verified → ${backupDir}`);
    }
    const seeded = new Set(
      (
        await c.query<{ k: string }>(
          `SELECT entity_type || ':' || (details->>'key') AS k FROM audit_log
            WHERE action = 'catalogue.seed' AND details->>'source' = $1`,
          [data.source],
        )
      ).rows.map((r) => r.k),
    );
    const log = (type: string, id: string, key: string, extra: Record<string, unknown> = {}) =>
      c.query(
        "INSERT INTO audit_log (staff_id, action, entity_type, entity_id, details) VALUES (NULL, 'catalogue.seed', $1, $2, $3)",
        [type, id, JSON.stringify({ source: data.source, key, via: "seed:starter", ...extra })],
      );
    const result: string[] = [];

    // Categories
    const catId = new Map<string, string | null>();
    for (const cat of data.categories) {
      const found = (
        await c.query<{ id: string; name: string; is_active: boolean }>(
          "SELECT id, name, is_active FROM categories WHERE slug = $1",
          [cat.slug],
        )
      ).rows[0];
      if (found) {
        catId.set(cat.slug, found.id);
        result.push(
          `category  REUSED   ${cat.slug} ("${found.name}", ${found.is_active ? "active" : "hidden"}; not modified)`,
        );
      } else if (seeded.has(`category:${cat.slug}`)) {
        catId.set(cat.slug, null);
        result.push(
          `category  SKIPPED  ${cat.slug} (created by this seed earlier and since removed by staff)`,
        );
      } else if (apply) {
        const id = (
          await c.query<{ id: string }>(
            `INSERT INTO categories (slug, name, description, sort_order, is_active, translations)
             VALUES ($1, $2, $3, $4, false, $5) RETURNING id`,
            [cat.slug, cat.name, cat.description, cat.sortOrder, JSON.stringify(cat.translations)],
          )
        ).rows[0]!.id;
        await log("category", id, cat.slug, {
          sourceDepartment: cat.sourceDepartment,
          translationsNeedReview: true,
        });
        catId.set(cat.slug, id);
        result.push(
          `category  CREATED  ${cat.slug} "${cat.name}" (hidden, order ${cat.sortOrder}, EN/TA/SI)`,
        );
      } else {
        catId.set(cat.slug, "new");
        result.push(`category  WOULD CREATE  ${cat.slug} "${cat.name}" (hidden, order ${cat.sortOrder})`);
      }
    }

    // Brands (name match ignores case, spaces, hyphens and accents)
    const existingBrands = (
      await c.query<{ id: string; slug: string; name: string; logo_key: string | null; is_active: boolean }>(
        "SELECT id, slug, name, logo_key, is_active FROM brands",
      )
    ).rows;
    const brandId = new Map<string, string | null>();
    for (const b of data.brands) {
      const found = existingBrands.find((e) => e.slug === b.slug || norm(e.name) === norm(b.name));
      if (found) {
        brandId.set(b.slug, found.id);
        result.push(
          `brand     REUSED   ${b.name} → existing "${found.name}" (${found.is_active ? "active" : "hidden"}, logo ${found.logo_key ? "kept" : "none"}; not modified)`,
        );
      } else if (seeded.has(`brand:${b.slug}`)) {
        brandId.set(b.slug, null);
        result.push(`brand     SKIPPED  ${b.name} (created by this seed earlier and since removed by staff)`);
      } else if (apply) {
        const id = (
          await c.query<{ id: string }>(
            "INSERT INTO brands (slug, name, is_active) VALUES ($1, $2, false) RETURNING id",
            [b.slug, b.name],
          )
        ).rows[0]!.id;
        await log("brand", id, b.slug);
        brandId.set(b.slug, id);
        result.push(`brand     CREATED  ${b.name} (hidden, no logo)`);
      } else {
        brandId.set(b.slug, "new");
        result.push(`brand     WOULD CREATE  ${b.name} (hidden, no logo)`);
      }
    }

    // Products
    let created = 0;
    for (const p of data.products) {
      const found = (
        await c.query<{ name: string; is_published: boolean }>(
          "SELECT name, is_published FROM products WHERE slug = $1 OR $2 = ANY(search_terms) LIMIT 1",
          [p.slug, codeTerm(p.code)],
        )
      ).rows[0];
      const label = `${p.code.padEnd(7)} LKR ${p.priceLkr.padStart(8)}  ${p.name}`;
      if (found) {
        result.push(`product   REUSED   ${label} (existing "${found.name}"; not modified)`);
        continue;
      }
      if (seeded.has(`product:${p.code}`)) {
        result.push(`product   SKIPPED  ${label} (created by this seed earlier and since removed by staff)`);
        continue;
      }
      const cat = catId.get(p.category);
      if (cat === null) {
        result.push(`product   SKIPPED  ${label} (its category was removed by staff)`);
        continue;
      }
      if (!apply) {
        result.push(
          `product   WOULD CREATE  ${label} → ${p.category}${p.brand ? ` / ${p.brand}` : ""} (draft)`,
        );
        continue;
      }
      const terms = [codeTerm(p.code), p.rawName.toLowerCase().slice(0, 60)];
      const id = (
        await c.query<{ id: string }>(
          `INSERT INTO products (name, slug, category_id, summary, search_terms, unit, price_lkr, contact_for_price,
                                 availability, is_published)
           VALUES ($1, $2, $3, $4, $5, $6, $7, false, 'on_request', false) RETURNING id`,
          [p.name, p.slug, cat, p.summary, terms, p.unit, p.priceLkr],
        )
      ).rows[0]!.id;
      const bid = p.brand ? brandId.get(p.brand) : null;
      if (bid) await c.query("INSERT INTO product_brands (product_id, brand_id) VALUES ($1, $2)", [id, bid]);
      await log("product", id, p.code, {
        code: p.code,
        rawName: p.rawName,
        priceLkr: p.priceLkr,
        priceSource: "Cash Price (initial, owner to confirm)",
        ...(p.sourceNote ? { sourceNote: p.sourceNote } : {}),
      });
      created++;
      result.push(
        `product   CREATED  ${label} → ${p.category}${bid ? ` / ${p.brand}` : " / (no brand)"} (draft, On Request)`,
      );
    }

    console.log(result.join("\n"));
    if (apply) {
      await c.query("COMMIT");
      console.log(`COMMITTED: ${created} product(s) created.`);
    } else {
      await c.query("ROLLBACK");
      console.log("Dry run only: nothing was written.");
    }
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    await c.end();
  }
}

main().catch((e: Error) => {
  console.error(e.message.replace(/postgres(ql)?:\/\/\S+/g, "postgres://***"));
  process.exit(1);
});
