import {
  catalogue,
  productCategories,
  productTypes as allProductTypes,
  type CatalogueProduct,
  type ProductCategory,
  type ProductCategoryId,
  type ProductType,
} from "../content/products.ts";

export type SearchResult = {
  categories: ProductCategory[];
  /** Documented product types (cement, TOR bars, plywood…). */
  productTypes: ProductType[];
  /** Individually listed catalogue items (none published yet). */
  products: CatalogueProduct[];
};

/** Lower-case, trim and collapse whitespace. */
export function normalizeQuery(query: string): string {
  return query.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);
}

function matcher(query: string): ((text: string) => boolean) | null {
  const q = normalizeQuery(query);
  if (!q) return null;
  const words = q.split(" ").filter((w) => w.length > 1);
  if (words.length === 0) return null;
  return (text: string) => {
    const t = text.toLowerCase();
    return words.some((w) => t.includes(w) || (w.length > 3 && w.includes(t)));
  };
}

/**
 * Matches the query against the verified categories (title + search terms),
 * the documented product types and the verified catalogue (currently empty).
 * Never invents results.
 */
export function searchProducts(
  query: string,
  categories: readonly ProductCategory[] = productCategories,
  products: readonly CatalogueProduct[] = catalogue,
  types: readonly ProductType[] = allProductTypes,
): SearchResult {
  const matches = matcher(query);
  if (!matches) return { categories: [], productTypes: [], products: [] };
  return {
    categories: categories.filter((c) => matches(c.title) || c.searchTerms.some(matches)),
    productTypes: types.filter((p) => matches(p.name) || p.searchTerms.some(matches)),
    products: products.filter((p) => matches(p.name)),
  };
}

/**
 * Product types shown on /products/ for a search query and category filter.
 * An empty query shows every product type in the selected category.
 */
export function filterProductTypes(
  query: string,
  category: ProductCategoryId | "all",
  types: readonly ProductType[] = allProductTypes,
): ProductType[] {
  const inCategory = category === "all" ? [...types] : types.filter((p) => p.category === category);
  const matches = matcher(query);
  if (!normalizeQuery(query)) return inCategory;
  if (!matches) return [];
  return inCategory.filter((p) => matches(p.name) || p.searchTerms.some(matches));
}

/** URL of the Products page for a query (empty query → the page itself). */
export function productsSearchHref(query: string): string {
  const q = normalizeQuery(query);
  return q ? `/products/?q=${encodeURIComponent(q)}#all-products` : "/products/";
}
