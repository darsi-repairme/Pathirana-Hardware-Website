/**
 * OPTIONAL, run by hand only: loads the client-confirmed catalogue structure.
 *
 *   npm run seed:catalogue -- --confirm-database=NAME
 *
 * • The 7 confirmed categories and 4 confirmed brands (active).
 * • The 8 confirmed product types, UNPUBLISHED, so staff review them before
 *   they appear publicly.
 * No prices, stock, SKUs, dimensions or product-brand links are created.
 * Re-running is safe: existing slugs are left unchanged.
 */
import { connect, databaseUrl, describe, requireConfirmation } from "./_db";

const categories = [
  [
    "building-materials",
    "Building Materials",
    "Cement and other materials for building and construction work.",
  ],
  ["steel-products", "Steel Products", "TOR bars and box bars for construction and fabrication."],
  ["plywood", "Plywood", "Plywood sheets for building, furniture and home projects."],
  ["doors-windows", "Doors & Windows", "Doors and windows for new homes and renovations."],
  ["bathroom-sanitary", "Bathroom & Sanitary", "Bathroom sets and sanitary products."],
  ["gas-cylinders", "Gas Cylinders", "Gas cylinders for home and business use."],
  [
    "branded-hardware",
    "Branded Hardware Products",
    "Hardware products from brands such as PE+, Swisstek, El Toro and Würth.",
  ],
] as const;

const brands = [
  ["pe-plus", "PE+"],
  ["swisstek", "Swisstek"],
  ["el-toro", "El Toro"],
  ["wurth", "Würth"],
] as const;

// [slug, name, category slug, summary, search terms]
const productTypes = [
  [
    "cement",
    "Cement",
    "building-materials",
    "Cement for building and construction work.",
    ["cement", "concrete", "masonry"],
  ],
  [
    "tor-bars",
    "TOR Bars",
    "steel-products",
    "TOR steel bars for reinforced construction.",
    ["tor", "steel", "rebar", "iron"],
  ],
  [
    "box-bars",
    "Box Bars",
    "steel-products",
    "Box bars for construction and fabrication work.",
    ["box bar", "steel", "hollow section"],
  ],
  [
    "plywood",
    "Plywood",
    "plywood",
    "Plywood sheets for building and home projects.",
    ["plywood", "ply", "board", "sheet"],
  ],
  ["doors", "Doors", "doors-windows", "Doors for new builds and renovations.", ["door", "frame"]],
  [
    "windows",
    "Windows",
    "doors-windows",
    "Windows for new builds and renovations.",
    ["window", "frame", "glass"],
  ],
  [
    "bathroom-sets",
    "Bathroom Sets",
    "bathroom-sanitary",
    "Bathroom sets for new homes and upgrades.",
    ["bathroom", "sanitary", "toilet", "basin"],
  ],
  [
    "gas-cylinders",
    "Gas Cylinders",
    "gas-cylinders",
    "Gas cylinders — ask the store about availability.",
    ["gas", "cylinder", "lpg"],
  ],
] as const;

async function main() {
  const url = databaseUrl();
  requireConfirmation(url);
  console.log(`Target: ${describe(url)}`);
  const client = await connect(url);
  try {
    await client.query("BEGIN");
    for (const [i, [slug, name, description]] of categories.entries()) {
      await client.query(
        "INSERT INTO categories (slug, name, description, sort_order) VALUES ($1, $2, $3, $4) ON CONFLICT (slug) DO NOTHING",
        [slug, name, description, i],
      );
    }
    for (const [slug, name] of brands) {
      await client.query("INSERT INTO brands (slug, name) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING", [
        slug,
        name,
      ]);
    }
    for (const [slug, name, category, summary, terms] of productTypes) {
      await client.query(
        `INSERT INTO products (slug, name, category_id, summary, search_terms)
         SELECT $1, $2, id, $4, $5 FROM categories WHERE slug = $3
         ON CONFLICT (slug) DO NOTHING`,
        [slug, name, category, summary, terms],
      );
    }
    await client.query(
      "INSERT INTO audit_log (action, entity_type, details) VALUES ('catalogue.seed', 'catalogue', $1)",
      [
        JSON.stringify({
          categories: categories.length,
          brands: brands.length,
          productTypes: productTypes.length,
        }),
      ],
    );
    await client.query("COMMIT");
    console.log("Catalogue structure loaded. Product types are unpublished until staff publish them.");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e: Error) => {
  console.error(e.message);
  process.exit(1);
});
