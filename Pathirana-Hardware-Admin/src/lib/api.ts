/**
 * Typed client for the admin UI. Every call goes to this app's own
 * /api/backend gateway (same origin); the session token stays in an HttpOnly
 * cookie and is never visible here.
 */
export type Role = "admin" | "editor";

export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  translations?: Translations<"name" | "description">;
  sortOrder: number;
  isActive: boolean;
  /** Staff-uploaded category image (migration 0003); null when none. Older APIs omit these. */
  imageKey?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  imageAlt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Brand = {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  /** Staff-uploaded logo (migration 0003); null when none. Older APIs omit these. */
  logoKey?: string | null;
  logoWidth?: number | null;
  logoHeight?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ProductImage = {
  id: string;
  altText: string;
  width: number;
  height: number;
  sizeBytes: number;
  sortOrder: number;
  isMain: boolean;
};

export type DiscountType = "none" | "percentage" | "fixed";
export type Availability = "available" | "out_of_stock" | "on_request";
export type DiscountStatus = "none" | "disabled" | "scheduled" | "expired" | "active";

/** Calculated by the API (the single authoritative calculation). Amounts are exact decimal strings. */
export type Price = {
  currency: "LKR";
  contactForPrice: boolean;
  original: string | null;
  discount: {
    type: "percentage" | "fixed";
    value: string;
    amount: string;
    startsOn: string | null;
    endsOn: string | null;
  } | null;
  final: string | null;
};

export type PricingFields = {
  unit: string | null;
  priceLkr: string | null;
  contactForPrice: boolean;
  discountType: DiscountType;
  discountValue: string | null;
  discountEnabled: boolean;
  discountStartsOn: string | null;
  discountEndsOn: string | null;
  availability: Availability;
  price: Price;
  discountStatus: DiscountStatus;
};

export type PricePreview = {
  valid: boolean;
  problems: string[];
  price: Price | null;
  discountStatus: DiscountStatus | null;
  /** The configured discount as if it were active today (null when there is none). */
  offer: Price | null;
};

export type ProductListItem = PricingFields & {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  categoryId: string;
  categoryName: string;
  isPublished: boolean;
  publishedAt: string | null;
  updatedAt: string;
  brands: { id: string; slug: string; name: string }[];
  image: { url: string; thumbUrl: string; alt: string } | null;
};

export type Product = PricingFields & {
  id: string;
  slug: string;
  name: string;
  categoryId: string;
  summary: string | null;
  description: string | null;
  searchTerms: string[];
  translations?: ProductTranslations;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  brands: { id: string; slug: string; name: string }[];
  images: ProductImage[];
};

export type Page<T> = { items: T[]; total: number; page: number; limit: number };

export type QuotationStatus = "new" | "in_review" | "quoted" | "closed" | "cancelled";
export const QUOTATION_STATUSES: readonly QuotationStatus[] = ["new", "in_review", "quoted", "closed", "cancelled"];
export const QUOTATION_STATUS_LABEL: Record<QuotationStatus, string> = {
  new: "New",
  in_review: "In Review",
  quoted: "Quoted",
  closed: "Closed",
  cancelled: "Cancelled",
};
export type QuotationListItem = {
  id: string;
  reference: string;
  customerName: string;
  phone: string;
  location: string;
  fulfilment: "delivery" | "collection";
  status: QuotationStatus;
  createdAt: string;
  itemCount: number;
  photoCount: number;
};
export type QuotationPage = Page<QuotationListItem> & { statusCounts: Record<QuotationStatus, number> };
export type QuotationDetail = Omit<QuotationListItem, "itemCount" | "photoCount"> & {
  email: string | null;
  locationListed: boolean;
  deliveryAddress: string | null;
  notes: string | null;
  contactConsent: boolean;
  updatedAt: string;
  statusChangedAt: string | null;
  statusChangedBy: string | null;
  items: {
    position: number;
    productName: string;
    quantity: string;
    unit: string | null;
    productId: string | null;
    productSlug: string | null;
  }[];
  photos: { id: string; position: number; width: number; height: number; sizeBytes: number }[];
  /** Promo code the customer quoted (migration 0009) and what the API found when it was saved. */
  promoCode?: string | null;
  promoStatus?: PromoStatus | null;
  promoOfferTitle?: string | null;
  promoOfferBenefit?: string | null;
};

/** Offers & promo codes (migration 0009). */
export type PromoStatus = "valid" | "not_eligible" | "expired" | "unknown";
export const PROMO_STATUS_LABEL: Record<PromoStatus, string> = {
  valid: "Valid for this request",
  not_eligible: "Code exists, but not for the requested items",
  expired: "Offer has ended",
  unknown: "Not a current offer code",
};
export type OfferStatus = "active" | "scheduled" | "expired" | "hidden";
export type OfferLink = { id: string; name: string; slug: string };
export type Offer = {
  id: string;
  title: string;
  benefit: string;
  description: string;
  discountType: "none" | "percentage" | "fixed";
  discountValue: number | null;
  promoCode: string | null;
  minPurchaseLkr: number | null;
  appliesTo: "all" | "selected";
  startsOn: string | null;
  endsOn: string | null;
  sortOrder: number;
  isPublished: boolean;
  status: OfferStatus;
  translations?: LocaleTexts;
  products: OfferLink[];
  categories: OfferLink[];
  createdAt: string;
  updatedAt: string;
};

/** Customer feedback (migration 0007). Only "approved" is ever shown on the website. */
export type FeedbackStatus = "pending" | "approved" | "rejected" | "hidden";
export const FEEDBACK_STATUSES: readonly FeedbackStatus[] = ["pending", "approved", "rejected", "hidden"];
export const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  hidden: "Hidden",
};
export const FEEDBACK_LANGUAGE_LABEL: Record<"en" | "ta" | "si", string> = {
  en: "English",
  ta: "Tamil",
  si: "Sinhala",
};
export type Feedback = {
  id: string;
  name: string;
  rating: number;
  message: string;
  location: string | null;
  language: "en" | "ta" | "si";
  status: FeedbackStatus;
  consent: boolean;
  consentVersion: string;
  note: string | null;
  submittedAt: string;
  moderatedAt: string | null;
  moderatedBy: string | null;
  approvedAt: string | null;
};
export type FeedbackPage = Page<Feedback> & { statusCounts: Record<FeedbackStatus, number> };

/**
 * Staff-entered Tamil (ta) / Sinhala (si) text (migration 0006). English stays in the
 * normal fields and is shown whenever a translation is missing. Older APIs omit this.
 */
export type LocaleText<K extends string> = Partial<Record<K, string>>;
export type Translations<K extends string> = Partial<Record<"ta" | "si", LocaleText<K>>>;
export type ProductTranslations = Partial<
  Record<"ta" | "si", { name?: string; summary?: string; description?: string; searchTerms?: string[] }>
>;

export type DeliveryArea = {
  id: string;
  name: string;
  district: string | null;
  postalCode: string | null;
  notes: string | null;
  translations?: Translations<"name" | "notes">;
  feeLkr: number | null;
  isActive: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StaffMember = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  /** An unused one-time set-up / reset link exists (migration 0008). */
  setupLinkPending?: boolean;
};

export type Dashboard = {
  counts: {
    products: number;
    publishedProducts: number;
    categories: number;
    brands: number;
    activeDeliveryAreas: number;
    /** Present once migration 0004 (quotation requests) is applied. */
    newQuotations?: number;
    /** Present once migration 0007 (customer feedback) is applied. */
    pendingFeedback?: number;
  };
  /** Admins only (audit:view); not sent at all for editors. */
  activity?: AuditEntry[];
};
export type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  createdAt: string;
  staffName: string | null;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
  }
}

const BASE = "/api/backend";

function sessionEnded() {
  if (typeof window !== "undefined") {
    const next = window.location.pathname;
    // Full navigation on purpose: a route handler clears the cookie, then shows /login.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/api/session/expired?next=${encodeURIComponent(next)}`);
  }
}

/** Human-readable message from the API's error shape { message: string | string[] }. */
async function toError(res: Response): Promise<ApiError> {
  let message = `Request failed (${res.status}).`;
  let details: string[] = [];
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) {
      details = body.message;
      message = "Please correct the highlighted details.";
    } else if (body.message) {
      message = body.message;
    }
  } catch {
    // Non-JSON body: keep the generic message.
  }
  if (res.status === 403) message = "You do not have permission to do this.";
  if (res.status === 409 && !details.length) message = body409(message);
  return new ApiError(res.status, message, details);
}

const body409 = (m: string) =>
  m.includes("linked") ? "This record is linked to other records." : "A record with these details already exists.";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(method !== "GET" ? { "x-ph-admin": "1" } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }
  if (res.status === 401) {
    sessionEnded();
    throw new ApiError(401, "Your session has ended. Please sign in again.");
  }
  if (!res.ok) throw await toError(res);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  del: <T = void>(path: string, body?: unknown) => request<T>("DELETE", path, body),
};

/** URL (same origin) to preview a product image, including unpublished products. */
export const imageUrl = (productId: string, imageId: string, size: "full" | "thumb" = "thumb") =>
  `${BASE}/admin/products/${productId}/images/${imageId}${size === "thumb" ? "?size=thumb" : ""}`;

/** Same-origin staff previews of uploaded brand logos / category images (inactive ones too).
 *  The file key is appended so a replaced file is never served from the browser cache. */
export const brandLogoUrl = (b: Pick<Brand, "id" | "logoKey">) => `${BASE}/admin/brands/${b.id}/logo?v=${b.logoKey}`;
export const categoryImageUrl = (c: Pick<Category, "id" | "imageKey">, size: "full" | "thumb" = "thumb") =>
  `${BASE}/admin/categories/${c.id}/image?v=${c.imageKey}${size === "thumb" ? "&size=thumb" : ""}`;

/** Same-origin, staff-only view of a customer's reference photo (never public). */
export const quotationPhotoUrl = (quotationId: string, photoId: string, size: "full" | "thumb" = "thumb") =>
  `${BASE}/admin/quotations/${quotationId}/photos/${photoId}${size === "thumb" ? "?size=thumb" : ""}`;

/** Upload with progress (XHR: fetch has no upload progress events). */
export function uploadImage(
  productId: string,
  file: File,
  altText: string,
  onProgress: (fraction: number) => void,
  makeMain = false,
): Promise<ProductImage> {
  return uploadFile<ProductImage>(
    `admin/products/${productId}/images`,
    file,
    { altText, ...(makeMain ? { isMain: "true" } : {}) },
    onProgress,
  );
}

/** multipart/form-data POST of one file (+ text fields) through the admin gateway, with progress. */
export function uploadFile<T>(
  path: string,
  file: File,
  fields: Record<string, string>,
  onProgress: (fraction: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    form.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/${path}`);
    xhr.setRequestHeader("x-ph-admin", "1");
    xhr.setRequestHeader("Accept", "application/json");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onerror = () => reject(new ApiError(0, "Upload failed. Check your connection and try again."));
    xhr.onload = async () => {
      const res = new Response(xhr.responseText || null, {
        status: xhr.status,
        headers: { "Content-Type": "application/json" },
      });
      if (xhr.status === 401) {
        sessionEnded();
        return reject(new ApiError(401, "Your session has ended."));
      }
      if (xhr.status === 413) return reject(new ApiError(413, "The image is too large."));
      if (xhr.status < 200 || xhr.status >= 300) return reject(await toError(res));
      resolve(JSON.parse(xhr.responseText) as T);
    };
    xhr.send(form);
  });
}

/** Query string from defined values. */
export function qs(params: Record<string, string | number | undefined | null | false>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== null && v !== "" && v !== false) sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Date and time in Sri Lanka, e.g. "20 Nov 2026, 3:31 pm". */
export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat("en-LK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo" }).format(
    new Date(iso),
  );

export const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

/* ── Services & Gallery (migration 0008) ───────────────────────────────── */
export const SERVICE_ICONS = ["bricks", "truck", "boxes", "bookmark", "lightbulb", "hardhat"] as const;
export const SERVICE_KINDS = ["materials", "delivery", "bulk", "reservations", "guidance", "contractor"] as const;
export type LocaleTexts = Partial<Record<"ta" | "si", Record<string, string>>>;

export type SiteService = {
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  summary: string;
  description: string;
  howToAsk: string;
  enquireAbout: string[];
  share: string;
  icon: (typeof SERVICE_ICONS)[number];
  kind: (typeof SERVICE_KINDS)[number];
  sortOrder: number;
  isPublished: boolean;
  imageKey: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  imageAlt: string | null;
  translations: LocaleTexts;
  updatedAt: string;
};

export type GalleryPhoto = {
  id: string;
  title: string;
  caption: string | null;
  altText: string;
  collection: string | null;
  sortOrder: number;
  isPublished: boolean;
  width: number;
  height: number;
  sizeBytes: number;
  translations: LocaleTexts;
  updatedAt: string;
};

export const serviceImageUrl = (s: Pick<SiteService, "id" | "imageKey">, size: "full" | "thumb" = "thumb") =>
  `${BASE}/admin/services/${s.id}/image?v=${s.imageKey}${size === "thumb" ? "&size=thumb" : ""}`;
export const galleryImageUrl = (g: Pick<GalleryPhoto, "id" | "updatedAt">, size: "full" | "thumb" = "thumb") =>
  `${BASE}/admin/gallery/${g.id}/image?v=${encodeURIComponent(g.updatedAt)}${size === "thumb" ? "&size=thumb" : ""}`;
