import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";
import type { PoolClient } from "pg";
import type { AuthStaff } from "../auth/auth.service";
import { SearchQuery, type Page } from "../common/dto";
import { likePattern, normaliseSearch, slugify } from "../common/text";
import { buildUpdate } from "../common/update";
import { AuditService } from "../database/audit.service";
import { DatabaseService } from "../database/database.service";
import {
  AVAILABILITY,
  computePrice,
  DATE,
  DISCOUNT_TYPES,
  discountStatus,
  MONEY,
  normalisePricing,
  pricingProblems,
  type Availability,
  type DiscountType,
  type PricingFields,
} from "./pricing";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** Validates the value whenever the key is present (null is rejected for NOT NULL fields). */
const Present = () => ValidateIf((_o, v) => v !== undefined);
const MONEY_MSG = { message: "$property must be an LKR amount with up to 2 decimals, e.g. 2500.00" };
const DATE_MSG = { message: "$property must be a date (YYYY-MM-DD)" };

/** Price, discount, unit and availability fields shared by create, update and preview. */
export class PricingBody {
  /** Free text such as bag, sheet or piece; null/"" clears it. */
  @IsOptional() @IsString() @MaxLength(40) unit?: string | null;
  @IsOptional() @IsString() @Matches(MONEY, MONEY_MSG) priceLkr?: string | null;
  @Present() @IsBoolean() contactForPrice?: boolean;
  @Present() @IsIn(DISCOUNT_TYPES) discountType?: DiscountType;
  @IsOptional() @IsString() @Matches(MONEY, MONEY_MSG) discountValue?: string | null;
  @Present() @IsBoolean() discountEnabled?: boolean;
  @IsOptional() @IsString() @Matches(DATE, DATE_MSG) discountStartsOn?: string | null;
  @IsOptional() @IsString() @Matches(DATE, DATE_MSG) discountEndsOn?: string | null;
  @Present() @IsIn(AVAILABILITY) availability?: Availability;
}

export class CreateProductBody extends PricingBody {
  @IsString() @MinLength(1) @MaxLength(160) name!: string;
  @IsOptional() @Matches(SLUG) @MaxLength(80) slug?: string;
  @IsUUID() categoryId!: string;
  @IsOptional() @IsString() @MaxLength(300) summary?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  searchTerms?: string[];
  /** Only brands confirmed for this product (never inferred). */
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsUUID("all", { each: true }) brandIds?: string[];
}

export class UpdateProductBody extends PricingBody {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(160) name?: string;
  @IsOptional() @Matches(SLUG) @MaxLength(80) slug?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsString() @MaxLength(300) summary?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  searchTerms?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsUUID("all", { each: true }) brandIds?: string[];
}

export class PublicationBody {
  @IsBoolean() published!: boolean;
}

export class ProductQuery extends SearchQuery {
  @IsOptional() @Matches(SLUG) @MaxLength(80) category?: string;
  @IsOptional() @Matches(SLUG) @MaxLength(80) brand?: string;
}

export class AdminProductQuery extends ProductQuery {
  @IsOptional() @Type(() => String) @Matches(/^(published|draft)$/) status?: "published" | "draft";
}

const PRICING_KEYS = [
  "priceLkr",
  "contactForPrice",
  "discountType",
  "discountValue",
  "discountEnabled",
  "discountStartsOn",
  "discountEndsOn",
] as const;

const DEFAULT_PRICING: PricingFields = {
  priceLkr: null,
  contactForPrice: true,
  discountType: "none",
  discountValue: null,
  discountEnabled: false,
  discountStartsOn: null,
  discountEndsOn: null,
};

/** Columns (aliased to API names) for unit, pricing and availability. Dates as text: no timezone shifts. */
const PRICING_COLUMNS = `p.unit, p.price_lkr::text AS "priceLkr", p.contact_for_price AS "contactForPrice",
  p.discount_type AS "discountType", p.discount_value::text AS "discountValue",
  p.discount_enabled AS "discountEnabled",
  to_char(p.discount_starts_on, 'YYYY-MM-DD') AS "discountStartsOn",
  to_char(p.discount_ends_on, 'YYYY-MM-DD') AS "discountEndsOn", p.availability`;

const COLUMN_OF: Record<string, string> = {
  name: "name",
  slug: "slug",
  categoryId: "category_id",
  summary: "summary",
  description: "description",
  searchTerms: "search_terms",
  unit: "unit",
  priceLkr: "price_lkr",
  contactForPrice: "contact_for_price",
  discountType: "discount_type",
  discountValue: "discount_value",
  discountEnabled: "discount_enabled",
  discountStartsOn: "discount_starts_on",
  discountEndsOn: "discount_ends_on",
  availability: "availability",
};

type PricedRow = PricingFields & { unit: string | null; availability: Availability };

const pricingOf = (r: PricingFields): PricingFields => ({
  priceLkr: r.priceLkr,
  contactForPrice: r.contactForPrice,
  discountType: r.discountType,
  discountValue: r.discountValue,
  discountEnabled: r.discountEnabled,
  discountStartsOn: r.discountStartsOn,
  discountEndsOn: r.discountEndsOn,
});

/** Public view: the calculated price only — never the raw discount settings. */
function publicPricing<T extends PricedRow>(row: T) {
  const {
    priceLkr: _p,
    contactForPrice: _c,
    discountType: _t,
    discountValue: _v,
    discountEnabled: _e,
    discountStartsOn: _s,
    discountEndsOn: _d,
    ...rest
  } = row;
  return { ...rest, price: computePrice(pricingOf(row)) };
}

/** Admin view: raw settings plus the same calculated price the public sees. */
const adminPricing = <T extends PricedRow>(row: T) => ({
  ...row,
  price: computePrice(pricingOf(row)),
  discountStatus: discountStatus(pricingOf(row)),
});

const blankToNull = (v: string | null | undefined) =>
  v === undefined ? undefined : v?.trim() ? v.trim() : null;

function throwIfInvalid(p: PricingFields) {
  const problems = pricingProblems(p);
  if (problems.length) throw new BadRequestException(problems);
}

type ImageRef = {
  id: string;
  product_id: string;
  alt_text: string;
  width: number;
  height: number;
  is_main: boolean;
};
const imageView = (i: ImageRef) => ({
  url: `/api/v1/product-images/${i.id}`,
  thumbUrl: `/api/v1/product-images/${i.id}?size=thumb`,
  alt: i.alt_text,
  width: i.width,
  height: i.height,
  isMain: i.is_main,
});

@Injectable()
export class ProductsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  /** Shared WHERE clause for search + category + brand filters. */
  private filters(q: ProductQuery, publicOnly: boolean, adminStatus?: string) {
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      params.push(value);
      where.push(sql.replaceAll("$?", `$${params.length}`));
    };
    if (publicOnly) where.push("p.is_published", "c.is_active");
    if (adminStatus) where.push(adminStatus === "published" ? "p.is_published" : "NOT p.is_published");
    const term = q.q ? normaliseSearch(q.q) : "";
    if (term) {
      // Also matches the product's category and brand NAMES (e.g. "Plywood", "Würth"), so a search
      // finds products staff filed under them even when the product name does not repeat the word.
      add(
        `(p.name ILIKE $? OR p.summary ILIKE $? OR p.description ILIKE $?
          OR EXISTS (SELECT 1 FROM unnest(p.search_terms) t WHERE t ILIKE $?)
          OR c.name ILIKE $?
          OR EXISTS (SELECT 1 FROM product_brands pb JOIN brands b ON b.id = pb.brand_id
                      WHERE pb.product_id = p.id AND b.name ILIKE $?${publicOnly ? " AND b.is_active" : ""}))`,
        likePattern(term),
      );
    }
    if (q.category) add("c.slug = $?", q.category);
    if (q.brand) {
      add(
        `EXISTS (SELECT 1 FROM product_brands pb JOIN brands b ON b.id = pb.brand_id
                  WHERE pb.product_id = p.id AND b.slug = $?${publicOnly ? " AND b.is_active" : ""})`,
        q.brand,
      );
    }
    return { where: where.length ? `WHERE ${where.join(" AND ")}` : "", params };
  }

  private async decorate<T extends { id: string }>(rows: T[], publicOnly: boolean) {
    const ids = rows.map((r) => r.id);
    if (!ids.length) return [];
    const brands = await this.db.query<{ product_id: string; id: string; slug: string; name: string }>(
      `SELECT pb.product_id, b.id, b.slug, b.name FROM product_brands pb JOIN brands b ON b.id = pb.brand_id
        WHERE pb.product_id = ANY($1)${publicOnly ? " AND b.is_active" : ""} ORDER BY b.name`,
      [ids],
    );
    // The designated main image (or, failing that, the first one).
    const images = await this.db.query<ImageRef>(
      `SELECT DISTINCT ON (product_id) id, product_id, alt_text, width, height, is_main FROM product_images
        WHERE product_id = ANY($1) ORDER BY product_id, is_main DESC, sort_order, created_at`,
      [ids],
    );
    return rows.map((r) => {
      const img = images.find((i) => i.product_id === r.id);
      const own = brands.filter((b) => b.product_id === r.id);
      return {
        ...r,
        brands: own.map((b) =>
          publicOnly ? { slug: b.slug, name: b.name } : { id: b.id, slug: b.slug, name: b.name },
        ),
        image: img ? imageView(img) : null,
      };
    });
  }

  async listPublic(q: ProductQuery): Promise<Page<unknown>> {
    const { where, params } = this.filters(q, true);
    const rows = await this.db.query<PricedRow & { id: string; total: number }>(
      `SELECT p.id, p.slug, p.name, p.summary, ${PRICING_COLUMNS},
              json_build_object('slug', c.slug, 'name', c.name) AS category,
              count(*) OVER ()::int AS total
         FROM products p JOIN categories c ON c.id = p.category_id
        ${where} ORDER BY p.name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, (q.page - 1) * q.limit],
    );
    const total = rows[0]?.total ?? 0;
    const items = (await this.decorate(rows, true)).map(({ id: _id, total: _t, ...rest }) =>
      publicPricing(rest),
    );
    return { items, total, page: q.page, limit: q.limit };
  }

  async getPublic(slug: string) {
    const row = await this.db.one<PricedRow & { id: string }>(
      `SELECT p.id, p.slug, p.name, p.summary, p.description, ${PRICING_COLUMNS},
              json_build_object('slug', c.slug, 'name', c.name) AS category
         FROM products p JOIN categories c ON c.id = p.category_id
        WHERE p.slug = $1 AND p.is_published AND c.is_active`,
      [slug],
    );
    if (!row) throw new NotFoundException("Product not found.");
    const [item] = await this.decorate([row], true);
    const images = await this.db.query<ImageRef>(
      `SELECT id, product_id, alt_text, width, height, is_main FROM product_images WHERE product_id = $1
        ORDER BY is_main DESC, sort_order, created_at`,
      [row.id],
    );
    const { id: _id, ...rest } = item!;
    return { ...publicPricing(rest), images: images.map(imageView) };
  }

  async listAll(q: AdminProductQuery): Promise<Page<unknown>> {
    const { where, params } = this.filters(q, false, q.status);
    const rows = await this.db.query<PricedRow & { id: string; total: number }>(
      `SELECT p.id, p.slug, p.name, p.summary, p.category_id AS "categoryId", c.name AS "categoryName",
              ${PRICING_COLUMNS},
              p.is_published AS "isPublished", p.published_at AS "publishedAt", p.updated_at AS "updatedAt",
              count(*) OVER ()::int AS total
         FROM products p JOIN categories c ON c.id = p.category_id
        ${where} ORDER BY p.updated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, (q.page - 1) * q.limit],
    );
    const total = rows[0]?.total ?? 0;
    const items = (await this.decorate(rows, false)).map(({ total: _t, ...rest }) => adminPricing(rest));
    return { items, total, page: q.page, limit: q.limit };
  }

  async getAdmin(id: string) {
    const row = await this.db.one<PricedRow & { id: string }>(
      `SELECT p.id, p.slug, p.name, p.category_id AS "categoryId", p.summary, p.description,
              p.search_terms AS "searchTerms", ${PRICING_COLUMNS},
              p.is_published AS "isPublished", p.published_at AS "publishedAt",
              p.created_at AS "createdAt", p.updated_at AS "updatedAt"
         FROM products p WHERE p.id = $1`,
      [id],
    );
    if (!row) throw new NotFoundException("Product not found.");
    const [decorated] = await this.decorate([row], false);
    const images = await this.db.query(
      `SELECT id, alt_text AS "altText", width, height, size_bytes AS "sizeBytes", sort_order AS "sortOrder",
              is_main AS "isMain", '/api/v1/product-images/' || id AS url
         FROM product_images WHERE product_id = $1 ORDER BY is_main DESC, sort_order, created_at`,
      [id],
    );
    const { image: _image, ...rest } = decorated!;
    return { ...adminPricing(rest), images };
  }

  /** Admin preview: the authoritative calculation for unsaved form values. */
  preview(body: PricingBody) {
    const p = normalisePricing({
      ...DEFAULT_PRICING,
      ...Object.fromEntries(PRICING_KEYS.filter((k) => body[k] !== undefined).map((k) => [k, body[k]])),
    } as PricingFields);
    const problems = pricingProblems(p);
    const ok = problems.length === 0;
    const hasOffer = ok && p.discountType !== "none" && !p.contactForPrice;
    return {
      valid: ok,
      problems,
      /** What customers would see today. */
      price: ok ? computePrice(p) : null,
      discountStatus: ok ? discountStatus(p) : null,
      /** The configured discount as if it were active (for a scheduled or switched-off discount). */
      offer: hasOffer
        ? computePrice({ ...p, discountEnabled: true, discountStartsOn: null, discountEndsOn: null })
        : null,
    };
  }

  private async setBrands(client: PoolClient, productId: string, brandIds: string[]) {
    await client.query("DELETE FROM product_brands WHERE product_id = $1", [productId]);
    const unique = [...new Set(brandIds)];
    if (unique.length) {
      await client.query("INSERT INTO product_brands (product_id, brand_id) SELECT $1, unnest($2::uuid[])", [
        productId,
        unique,
      ]);
    }
  }

  /** New products start unpublished. */
  async create(body: CreateProductBody, staff: AuthStaff) {
    const slug = body.slug ?? slugify(body.name);
    if (!slug) throw new BadRequestException("Could not create a slug from this name; provide one.");
    const pricing = normalisePricing({
      priceLkr: blankToNull(body.priceLkr) ?? null,
      contactForPrice: body.contactForPrice ?? DEFAULT_PRICING.contactForPrice,
      discountType: body.discountType ?? "none",
      discountValue: blankToNull(body.discountValue) ?? null,
      discountEnabled: body.discountEnabled ?? false,
      discountStartsOn: blankToNull(body.discountStartsOn) ?? null,
      discountEndsOn: blankToNull(body.discountEndsOn) ?? null,
    });
    throwIfInvalid(pricing);
    const id = await this.db.tx(async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO products (name, slug, category_id, summary, description, search_terms, unit, price_lkr,
                               contact_for_price, discount_type, discount_value, discount_enabled,
                               discount_starts_on, discount_ends_on, availability)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`,
        [
          body.name.trim(),
          slug,
          body.categoryId,
          body.summary ?? null,
          body.description ?? null,
          (body.searchTerms ?? []).map(normaliseSearch).filter(Boolean),
          blankToNull(body.unit) ?? null,
          pricing.priceLkr,
          pricing.contactForPrice,
          pricing.discountType,
          pricing.discountValue,
          pricing.discountEnabled,
          pricing.discountStartsOn,
          pricing.discountEndsOn,
          body.availability ?? "on_request",
        ],
      );
      const productId = rows[0]!.id;
      if (body.brandIds) await this.setBrands(client, productId, body.brandIds);
      await this.audit.log(
        staff.id,
        "product.create",
        "product",
        productId,
        { name: body.name, slug, pricing },
        client,
      );
      return productId;
    });
    return this.getAdmin(id);
  }

  async update(id: string, body: UpdateProductBody, staff: AuthStaff) {
    const { brandIds, ...fields } = body;
    if (fields.searchTerms) fields.searchTerms = fields.searchTerms.map(normaliseSearch).filter(Boolean);
    for (const k of ["unit", "priceLkr", "discountValue", "discountStartsOn", "discountEndsOn"] as const) {
      fields[k] = blankToNull(fields[k]);
    }
    if (!Object.values(fields).some((v) => v !== undefined) && brandIds === undefined) {
      throw new BadRequestException("Nothing to update.");
    }
    await this.db.tx(async (client) => {
      const current = (
        await client.query<PricingFields>(
          `SELECT ${PRICING_COLUMNS} FROM products p WHERE p.id = $1 FOR UPDATE`,
          [id],
        )
      ).rows[0];
      if (!current) throw new NotFoundException("Product not found.");
      const changed: string[] = [];
      const touchesPricing = PRICING_KEYS.some((k) => fields[k] !== undefined);
      let pricing: PricingFields | undefined;
      if (touchesPricing) {
        // Validate the complete resulting state, not just the submitted fields.
        const merged = { ...pricingOf(current) } as Record<string, unknown>;
        for (const k of PRICING_KEYS) if (fields[k] !== undefined) merged[k] = fields[k];
        pricing = normalisePricing(merged as PricingFields);
        throwIfInvalid(pricing);
        // Write only what differs (normalisation may also clear related fields).
        const out = fields as Record<string, unknown>;
        for (const k of PRICING_KEYS) out[k] = pricing[k] !== current[k] ? pricing[k] : undefined;
      }
      if (Object.values(fields).some((v) => v !== undefined)) {
        const u = buildUpdate({ ...fields }, COLUMN_OF);
        await client.query(`UPDATE products SET ${u.set} WHERE id = $1`, [id, ...u.params]);
        changed.push(...u.changed);
      }
      if (brandIds !== undefined) {
        await this.setBrands(client, id, brandIds);
        changed.push("brandIds");
      }
      await this.audit.log(
        staff.id,
        "product.update",
        "product",
        id,
        pricing ? { changed, pricing } : { changed },
        client,
      );
    });
    return this.getAdmin(id);
  }

  async setPublished(id: string, published: boolean, staff: AuthStaff) {
    const row = await this.db.one(
      `UPDATE products SET is_published = $2,
              published_at = CASE WHEN $2 THEN coalesce(published_at, now()) ELSE published_at END
        WHERE id = $1 RETURNING id`,
      [id, published],
    );
    if (!row) throw new NotFoundException("Product not found.");
    await this.audit.log(staff.id, published ? "product.publish" : "product.unpublish", "product", id);
    return this.getAdmin(id);
  }
}
