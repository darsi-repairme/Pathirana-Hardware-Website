/**
 * Product search helpers. The search itself runs against the live database (the website API's
 * published products, see LiveCatalogue); nothing bundled with the site is searched.
 */

/** Lower-case, trim and collapse whitespace. */
export function normalizeQuery(query: string): string {
  return query.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);
}

/** URL of the Products page for a query (empty query → the page itself). */
export function productsSearchHref(query: string): string {
  const q = normalizeQuery(query);
  return q ? `/products/?q=${encodeURIComponent(q)}#all-products` : "/products/";
}
