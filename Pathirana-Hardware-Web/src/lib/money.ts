/**
 * LKR formatting (display only, no arithmetic — the API calculates every price).
 * Kept free of imports so the unit tests can load it directly.
 */

/** "2250.5" → "LKR 2,250.50" */
export function formatLkr(amount: string): string {
  const [whole = "0", frac = ""] = amount.split(".");
  return `LKR ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${frac.padEnd(2, "0").slice(0, 2)}`;
}
