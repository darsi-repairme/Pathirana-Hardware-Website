/**
 * Display format of the one-time Owner verification code: 16 letters/digits shown as
 * XXXX-XXXX-XXXX-XXXX. Formatting only — the API still normalises and verifies the code
 * (Crockford look-alikes O → 0, I / L → 1 are handled there).
 */
export const OWNER_CODE_LENGTH = 16;

/** Letters and digits only, upper case, at most 16 (hyphens and spaces never count). */
export const ownerCodeChars = (raw: string) =>
  raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, OWNER_CODE_LENGTH);

/** "abcd efgh-jk" → "ABCD-EFGH-JK" (a hyphen only between complete groups of four). */
export const formatOwnerCode = (raw: string) => ownerCodeChars(raw).replace(/(.{4})(?=.)/g, "$1-");

/**
 * New value and caret position after an edit: the caret stays after the same number of
 * letters/digits as before reformatting, so typing or deleting in the middle does not jump to the end.
 */
export function reformatOwnerCode(raw: string, caret: number): { value: string; caret: number } {
  const value = formatOwnerCode(raw);
  const before = ownerCodeChars(raw.slice(0, caret)).length;
  let pos = 0;
  for (let seen = 0; pos < value.length && seen < before; pos++) if (value[pos] !== "-") seen++;
  return { value, caret: pos };
}
