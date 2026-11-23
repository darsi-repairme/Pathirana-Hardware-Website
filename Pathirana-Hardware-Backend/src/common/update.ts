import { BadRequestException } from "@nestjs/common";

/**
 * Builds "col = $n" assignments for the fields present in `body`, using the
 * allow-listed `columns` map (body key → column). Values start at $`offset`.
 */
export function buildUpdate(
  body: Record<string, unknown>,
  columns: Record<string, string>,
  offset = 2,
): { set: string; params: unknown[]; changed: string[] } {
  const parts: string[] = [];
  const params: unknown[] = [];
  const changed: string[] = [];
  for (const [key, column] of Object.entries(columns)) {
    if (body[key] === undefined) continue;
    params.push(body[key]);
    parts.push(`${column} = $${offset + params.length - 1}`);
    changed.push(key);
  }
  if (parts.length === 0) throw new BadRequestException("Nothing to update.");
  return { set: parts.join(", "), params, changed };
}
