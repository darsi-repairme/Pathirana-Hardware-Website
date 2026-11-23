/**
 * Product ENQUIRY basket (client-side only).
 *
 * Visitors can collect verified catalogue items and prepare an enquiry email.
 * There is no checkout, payment, order submission or POS integration — the
 * enquiry is simply an email the visitor chooses to send.
 *
 * Items can only be added from the verified catalogue, which is empty until
 * the business supplies one, so the basket currently always shows its empty
 * state and no count badge.
 */
export type BasketItem = { id: string; name: string; quantity: number };

export const BASKET_STORAGE_KEY = "ph-enquiry-basket";
const MAX_ITEMS = 50;
const MAX_QTY = 999;

export function addItem(items: readonly BasketItem[], item: { id: string; name: string }, quantity = 1): BasketItem[] {
  const qty = Math.max(1, Math.min(MAX_QTY, Math.floor(quantity)));
  const existing = items.find((i) => i.id === item.id);
  if (existing) {
    return items.map((i) => (i.id === item.id ? { ...i, quantity: Math.min(MAX_QTY, i.quantity + qty) } : i));
  }
  if (items.length >= MAX_ITEMS) return [...items];
  return [...items, { id: item.id, name: item.name, quantity: qty }];
}

export function removeItem(items: readonly BasketItem[], id: string): BasketItem[] {
  return items.filter((i) => i.id !== id);
}

export function itemCount(items: readonly BasketItem[]): number {
  return items.reduce((n, i) => n + i.quantity, 0);
}

/** Only keeps well-formed items whose ids exist in the verified catalogue. */
export function parseBasket(raw: string | null, validIds: ReadonlySet<string>): BasketItem[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (i): i is BasketItem =>
          typeof i === "object" &&
          i !== null &&
          typeof (i as BasketItem).id === "string" &&
          typeof (i as BasketItem).name === "string" &&
          Number.isInteger((i as BasketItem).quantity) &&
          (i as BasketItem).quantity > 0 &&
          validIds.has((i as BasketItem).id),
      )
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

/** mailto: link that pre-fills an enquiry email (the visitor sends it themselves). */
export function enquiryMailto(email: string, items: readonly BasketItem[]): string {
  const lines = items.map((i) => `- ${i.name} × ${i.quantity}`);
  const body = ["Hello Pathirana Hardware,", "", "I would like to ask about:", ...lines, "", "Thank you."].join("\n");
  return `mailto:${email}?subject=${encodeURIComponent("Product enquiry")}&body=${encodeURIComponent(body)}`;
}
