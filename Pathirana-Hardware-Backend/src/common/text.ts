/** URL slug from a display name: "Doors & Windows" → "doors-windows", "Würth" → "wurth". */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** Normalises free text typed by a visitor for matching: trims, collapses spaces, lower-cases. */
export function normaliseSearch(input: string): string {
  return input.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Escapes LIKE wildcards so user input is matched literally. */
export function likePattern(input: string): string {
  return `%${input.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
