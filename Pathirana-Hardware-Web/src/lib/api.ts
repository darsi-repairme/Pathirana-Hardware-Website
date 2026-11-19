/**
 * Website API base URL (the separate NestJS backend), e.g.
 * NEXT_PUBLIC_API_URL=https://api.example.lk at build time. When it is not
 * set, features that need the API show their contact-the-shop fallback.
 */
export function getApiBase(raw: string | undefined = process.env.NEXT_PUBLIC_API_URL): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/** GET a JSON endpoint of the public API with a timeout. Throws on any failure. */
export async function apiGet<T>(path: string, signal?: AbortSignal, timeoutMs = 8000): Promise<T> {
  const base = getApiBase();
  if (!base) throw new Error("API not configured");
  const timeout = AbortSignal.timeout(timeoutMs);
  const res = await fetch(`${base}${path}`, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    headers: { Accept: "application/json" },
    credentials: "omit",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return (await res.json()) as T;
}

export type DeliveryArea = {
  id: string;
  name: string;
  district: string | null;
  postalCode: string | null;
  notes: string | null;
};
export type DeliveryAreaList = { items: DeliveryArea[]; total: number };
export type DeliveryCheck = {
  query: string;
  supported: boolean;
  area: DeliveryArea | null;
  areasListed: boolean;
};
