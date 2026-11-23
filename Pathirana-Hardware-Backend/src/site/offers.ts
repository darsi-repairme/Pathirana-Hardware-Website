import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import type { PoolClient } from "pg";
import type { AuthStaff } from "../auth/auth.service";
import { RequirePermission, roleHas } from "../auth/roles";
import { CurrentStaff, StaffAuthGuard } from "../auth/staff-auth.guard";
import { cleanTranslations } from "../common/translations";
import { AuditService } from "../database/audit.service";
import { DatabaseService } from "../database/database.service";
import { pastDateProblems } from "../catalogue/pricing";

/**
 * Offers & promo codes (migration 0009).
 *
 * There is no online checkout: a customer copies a code from the website and quotes it in a
 * quotation request. The API records whether the code was valid for that request; staff confirm
 * prices manually. Offer discounts never change product prices and never stack automatically.
 *
 * Only PUBLISHED offers inside their date range (Sri Lanka date) are ever public. Unpublished,
 * scheduled and hidden offers are never revealed — an unknown and a hidden code look the same.
 */
export const DISCOUNT_TYPES = ["none", "percentage", "fixed"] as const;
export const PROMO_STATUSES = ["valid", "not_eligible", "expired", "unknown"] as const;
export type PromoStatus = (typeof PROMO_STATUSES)[number];
const CODE = /^[A-Za-z0-9][A-Za-z0-9-]{2,31}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ORDER_MSG = "Display order must be a whole number (0 or more).";
const OFFER_TEXT = { line: ["title", "benefit"], multiline: ["description"] };
/** Today in Sri Lanka (offer dates are calendar days for the shop). */
const TODAY = "(now() AT TIME ZONE 'Asia/Colombo')::date";
const ACTIVE = `o.is_published AND (o.starts_on IS NULL OR o.starts_on <= ${TODAY}) AND (o.ends_on IS NULL OR o.ends_on >= ${TODAY})`;

class OfferLocaleText {
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(120) benefit?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
}
class OfferTranslations {
  @IsOptional() @IsObject() @ValidateNested() @Type(() => OfferLocaleText) ta?: OfferLocaleText;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => OfferLocaleText) si?: OfferLocaleText;
}

class OfferFields {
  @IsOptional() @IsString() @MaxLength(120) benefit?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsIn(DISCOUNT_TYPES) discountType?: (typeof DISCOUNT_TYPES)[number];
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: "Discount value: a number with at most 2 decimals." })
  @Min(0, { message: "Discount value cannot be negative." })
  @Max(100_000_000)
  discountValue?: number | null;
  @IsOptional()
  @Matches(CODE, { message: "Promo code: 3–32 letters, digits or hyphens (no spaces)." })
  promoCode?: string | null;
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: "Minimum purchase: a number with at most 2 decimals." })
  @Min(0, { message: "Minimum purchase cannot be negative." })
  @Max(100_000_000)
  minPurchaseLkr?: number | null;
  @IsOptional() @IsIn(["all", "selected"]) appliesTo?: "all" | "selected";
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsUUID("all", { each: true }) productIds?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsUUID("all", { each: true }) categoryIds?: string[];
  @IsOptional() @Matches(DATE, { message: "Start date: YYYY-MM-DD." }) startsOn?: string | null;
  @IsOptional() @Matches(DATE, { message: "End date: YYYY-MM-DD." }) endsOn?: string | null;
  @IsOptional() @IsInt({ message: ORDER_MSG }) @Min(0, { message: ORDER_MSG }) @Max(9999) sortOrder?: number;
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => OfferTranslations)
  translations?: OfferTranslations;
}
export class CreateOfferBody extends OfferFields {
  @IsString() @MinLength(1, { message: "Enter the offer title." }) @MaxLength(120) title!: string;
}
export class UpdateOfferBody extends OfferFields {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: "Enter the offer title." })
  @MaxLength(120)
  title?: string;
}
class PublicationBody {
  @IsBoolean() isPublished!: boolean;
}
export class ValidateCodeBody {
  @IsString() @MaxLength(40) code!: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  productSlugs?: string[];
}

const clean = (s: string | undefined | null) =>
  s === undefined || s === null ? s : s.normalize("NFC").replace(/\s+/g, " ").trim();
const cleanBlock = (s: string | undefined) =>
  s === undefined
    ? undefined
    : s
        .normalize("NFC")
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map((l) => l.replace(/[ \t]+/g, " ").trim())
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
export const normaliseCode = (raw: string | null | undefined) => {
  const c = raw?.trim().toUpperCase() ?? "";
  return c ? c : null;
};
const isValidDate = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

const COLUMNS = `o.id, o.title, o.benefit, o.description, o.discount_type AS "discountType",
  o.discount_value::float8 AS "discountValue", o.promo_code AS "promoCode",
  o.min_purchase_lkr::float8 AS "minPurchaseLkr", o.applies_to AS "appliesTo",
  to_char(o.starts_on, 'YYYY-MM-DD') AS "startsOn", to_char(o.ends_on, 'YYYY-MM-DD') AS "endsOn",
  o.sort_order AS "sortOrder", o.is_published AS "isPublished", o.translations,
  o.created_at AS "createdAt", o.updated_at AS "updatedAt"`;
const STATUS = `CASE WHEN NOT o.is_published THEN 'hidden'
  WHEN o.ends_on IS NOT NULL AND o.ends_on < ${TODAY} THEN 'expired'
  WHEN o.starts_on IS NOT NULL AND o.starts_on > ${TODAY} THEN 'scheduled'
  ELSE 'active' END`;

type Link = { id: string; name: string; slug: string };
type OfferRow = {
  id: string;
  discountType: string;
  discountValue: number | null;
  promoCode: string | null;
  startsOn: string | null;
  endsOn: string | null;
  isPublished: boolean;
};

@Injectable()
export class OffersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  /** Cleans and cross-checks the fields; `current` is the stored offer when updating. */
  private normalise(body: UpdateOfferBody, current?: OfferRow) {
    const problems: string[] = [];
    const title = clean(body.title);
    if (title === "") problems.push("Enter the offer title.");
    const type = body.discountType ?? (current?.discountType as (typeof DISCOUNT_TYPES)[number]) ?? "none";
    let value = body.discountValue === undefined ? (current?.discountValue ?? null) : body.discountValue;
    if (type === "none") value = null;
    else if (value === null || value === undefined) problems.push("Enter the discount value.");
    else if (value <= 0) problems.push("The discount value must be more than 0.");
    else if (type === "percentage" && value > 100)
      problems.push("A percentage discount cannot be more than 100%.");
    const startsOn = body.startsOn === undefined ? (current?.startsOn ?? null) : body.startsOn;
    const endsOn = body.endsOn === undefined ? (current?.endsOn ?? null) : body.endsOn;
    for (const [label, d] of [
      ["start", startsOn],
      ["end", endsOn],
    ] as const)
      if (d && !isValidDate(d)) problems.push(`The ${label} date is not a real date.`);
    if (startsOn && endsOn && endsOn < startsOn)
      problems.push("The end date must be on or after the start date.");
    // Future-only: a start / end date that is set or changed cannot be in the past (Sri Lanka date).
    problems.push(
      ...pastDateProblems([
        { label: "start date", value: startsOn, previous: current?.startsOn ?? null },
        { label: "end date", value: endsOn, previous: current?.endsOn ?? null },
      ]),
    );
    if (problems.length) throw new BadRequestException(problems);
    return {
      title,
      benefit: clean(body.benefit),
      description: cleanBlock(body.description),
      discountType: type,
      discountValue: value,
      promoCode: body.promoCode === undefined ? undefined : normaliseCode(body.promoCode),
      minPurchaseLkr: body.minPurchaseLkr,
      appliesTo: body.appliesTo,
      startsOn,
      endsOn,
      sortOrder: body.sortOrder,
      translations:
        body.translations === undefined ? undefined : cleanTranslations(body.translations, OFFER_TEXT),
    };
  }

  private async withLinks<T extends { id: string }>(
    rows: T[],
    client?: PoolClient,
  ): Promise<(T & { products: Link[]; categories: Link[] })[]> {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const q = client
      ? (s: string, p: unknown[]) => client.query(s, p).then((r) => r.rows)
      : this.db.query.bind(this.db);
    const products = (await q(
      `SELECT op.offer_id, p.id, p.name, p.slug FROM offer_products op JOIN products p ON p.id = op.product_id
        WHERE op.offer_id = ANY($1::uuid[]) ORDER BY p.name`,
      [ids],
    )) as { offer_id: string; id: string; name: string; slug: string }[];
    const categories = (await q(
      `SELECT oc.offer_id, c.id, c.name, c.slug FROM offer_categories oc JOIN categories c ON c.id = oc.category_id
        WHERE oc.offer_id = ANY($1::uuid[]) ORDER BY c.name`,
      [ids],
    )) as { offer_id: string; id: string; name: string; slug: string }[];
    return rows.map((r) => ({
      ...r,
      products: products.filter((p) => p.offer_id === r.id).map(({ offer_id: _o, ...p }) => p),
      categories: categories.filter((c) => c.offer_id === r.id).map(({ offer_id: _o, ...c }) => c),
    }));
  }

  async listAdmin() {
    const rows = await this.db.query<{ id: string }>(
      `SELECT ${COLUMNS}, ${STATUS} AS status FROM offers o ORDER BY o.sort_order, o.created_at DESC`,
    );
    return this.withLinks(rows);
  }

  private async getAdmin(id: string, client?: PoolClient) {
    const sql = `SELECT ${COLUMNS}, ${STATUS} AS status FROM offers o WHERE o.id = $1`;
    const row = client ? (await client.query(sql, [id])).rows[0] : await this.db.one(sql, [id]);
    if (!row) throw new NotFoundException("Offer not found.");
    return (await this.withLinks([row as { id: string; appliesTo: string }], client))[0]!;
  }

  /** Public: published offers within their dates; only published products and active categories. */
  async listPublic() {
    const rows = await this.db.query<{ id: string }>(
      `SELECT o.id, o.title, o.benefit, o.description, o.discount_type AS "discountType",
              o.discount_value::float8 AS "discountValue", o.promo_code AS "promoCode",
              o.min_purchase_lkr::float8 AS "minPurchaseLkr", o.applies_to AS "appliesTo",
              to_char(o.ends_on, 'YYYY-MM-DD') AS "endsOn", o.translations,
              COALESCE((SELECT json_agg(json_build_object('name', p.name, 'slug', p.slug) ORDER BY p.name)
                          FROM offer_products op JOIN products p ON p.id = op.product_id
                         WHERE op.offer_id = o.id AND p.is_published), '[]') AS products,
              COALESCE((SELECT json_agg(json_build_object('name', c.name, 'slug', c.slug) ORDER BY c.name)
                          FROM offer_categories oc JOIN categories c ON c.id = oc.category_id
                         WHERE oc.offer_id = o.id AND c.is_active), '[]') AS categories
         FROM offers o WHERE ${ACTIVE}
        ORDER BY o.sort_order, o.created_at DESC`,
    );
    return rows;
  }

  private async setLinks(client: PoolClient, id: string, productIds?: string[], categoryIds?: string[]) {
    if (productIds !== undefined) {
      await client.query("DELETE FROM offer_products WHERE offer_id = $1", [id]);
      if (productIds.length) {
        const r = await client.query(
          `INSERT INTO offer_products (offer_id, product_id)
           SELECT $1, p.id FROM products p WHERE p.id = ANY($2::uuid[])`,
          [id, [...new Set(productIds)]],
        );
        if (r.rowCount !== new Set(productIds).size)
          throw new BadRequestException(["A chosen product no longer exists."]);
      }
    }
    if (categoryIds !== undefined) {
      await client.query("DELETE FROM offer_categories WHERE offer_id = $1", [id]);
      if (categoryIds.length) {
        const r = await client.query(
          `INSERT INTO offer_categories (offer_id, category_id)
           SELECT $1, c.id FROM categories c WHERE c.id = ANY($2::uuid[])`,
          [id, [...new Set(categoryIds)]],
        );
        if (r.rowCount !== new Set(categoryIds).size)
          throw new BadRequestException(["A chosen category no longer exists."]);
      }
    }
  }

  private conflict(e: unknown): never {
    if ((e as { code?: string }).code === "23505")
      throw new ConflictException("Another offer already uses this promo code.");
    throw e;
  }

  async create(body: CreateOfferBody, staff: AuthStaff) {
    const v = this.normalise(body);
    try {
      return await this.db.tx(async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO offers (title, benefit, description, discount_type, discount_value, promo_code,
                               min_purchase_lkr, applies_to, starts_on, ends_on, sort_order, translations, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
          [
            v.title,
            v.benefit ?? "",
            v.description ?? "",
            v.discountType,
            v.discountValue,
            v.promoCode ?? null,
            v.minPurchaseLkr ?? null,
            v.appliesTo ?? "all",
            v.startsOn,
            v.endsOn,
            v.sortOrder ?? 0,
            JSON.stringify(v.translations ?? {}),
            staff.id,
          ],
        );
        const id = rows[0]!.id;
        await this.setLinks(client, id, body.productIds ?? [], body.categoryIds ?? []);
        const created = await this.getAdmin(id, client);
        if (created.appliesTo === "selected" && !created.products.length && !created.categories.length)
          throw new BadRequestException([
            "Choose at least one product or category, or apply the offer to all products.",
          ]);
        await this.audit.log(staff.id, "offer.create", "offer", id, { code: v.promoCode ?? null }, client);
        return created;
      });
    } catch (e) {
      this.conflict(e);
    }
  }

  async update(id: string, body: UpdateOfferBody, staff: AuthStaff) {
    const current =
      (await this.db.one<OfferRow>(`SELECT ${COLUMNS} FROM offers o WHERE o.id = $1`, [id])) ?? null;
    if (!current) throw new NotFoundException("Offer not found.");
    const v = this.normalise(body, current);
    // A live offer's code, discount and dates are what customers rely on: admins only.
    const sensitive =
      (v.promoCode !== undefined && v.promoCode !== current.promoCode) ||
      v.discountType !== current.discountType ||
      (v.discountValue ?? null) !== (current.discountValue ?? null) ||
      v.startsOn !== current.startsOn ||
      v.endsOn !== current.endsOn;
    if (current.isPublished && sensitive && !roleHas(staff.role, "offers:publish"))
      throw new ForbiddenException(
        "Only an admin can change the code, discount or dates of a published offer.",
      );
    const fields: Record<string, unknown> = {
      title: v.title,
      benefit: v.benefit,
      description: v.description,
      discount_type: v.discountType,
      discount_value: v.discountValue,
      promo_code: v.promoCode,
      min_purchase_lkr: v.minPurchaseLkr,
      applies_to: v.appliesTo,
      starts_on: v.startsOn,
      ends_on: v.endsOn,
      sort_order: v.sortOrder,
      translations: v.translations === undefined ? undefined : JSON.stringify(v.translations),
    };
    const entries = Object.entries(fields).filter(([, x]) => x !== undefined);
    try {
      return await this.db.tx(async (client) => {
        if (entries.length)
          await client.query(
            `UPDATE offers SET ${entries.map(([k], i) => `${k} = $${i + 2}`).join(", ")} WHERE id = $1`,
            [id, ...entries.map(([, x]) => x)],
          );
        await this.setLinks(client, id, body.productIds, body.categoryIds);
        const after = await this.getAdmin(id, client);
        if (after.appliesTo === "selected" && !after.products.length && !after.categories.length)
          throw new BadRequestException([
            "Choose at least one product or category, or apply the offer to all products.",
          ]);
        await this.audit.log(
          staff.id,
          "offer.update",
          "offer",
          id,
          { changed: entries.map(([k]) => k) },
          client,
        );
        return after;
      });
    } catch (e) {
      this.conflict(e);
    }
  }

  async setPublished(id: string, published: boolean, staff: AuthStaff) {
    const row = await this.db.one("UPDATE offers SET is_published = $2 WHERE id = $1 RETURNING id", [
      id,
      published,
    ]);
    if (!row) throw new NotFoundException("Offer not found.");
    await this.audit.log(staff.id, published ? "offer.publish" : "offer.hide", "offer", id);
    return this.getAdmin(id);
  }

  /**
   * What a quoted code means for these products (used by the public check and the quotation API).
   * "unknown" covers codes that do not exist AND unpublished / not-yet-started offers (never revealed).
   */
  async checkCode(rawCode: string, productSlugs: string[] = [], client?: PoolClient) {
    const code = normaliseCode(rawCode);
    if (!code || !CODE.test(code)) return { code, status: "unknown" as PromoStatus, offer: null };
    const q = client
      ? (s: string, p: unknown[]) => client.query(s, p).then((r) => r.rows[0])
      : this.db.one.bind(this.db);
    const o = (await q(
      `SELECT o.id, o.applies_to AS "appliesTo", o.title, o.benefit, to_char(o.ends_on, 'YYYY-MM-DD') AS "endsOn",
              (${ACTIVE}) AS active, (o.is_published AND o.ends_on IS NOT NULL AND o.ends_on < ${TODAY}) AS ended
         FROM offers o WHERE o.promo_code = $1`,
      [code],
    )) as
      | {
          id: string;
          appliesTo: string;
          title: string;
          benefit: string;
          endsOn: string | null;
          active: boolean;
          ended: boolean;
        }
      | undefined;
    if (!o || (!o.active && !o.ended)) return { code, status: "unknown" as PromoStatus, offer: null };
    if (o.ended) return { code, status: "expired" as PromoStatus, offer: null, offerId: o.id };
    const summary = { title: o.title, benefit: o.benefit, endsOn: o.endsOn };
    if (o.appliesTo === "all") return { code, status: "valid" as PromoStatus, offer: summary, offerId: o.id };
    const slugs = [...new Set(productSlugs.filter(Boolean))];
    if (!slugs.length) return { code, status: "not_eligible" as PromoStatus, offer: summary, offerId: o.id };
    const match = await q(
      `SELECT 1 FROM products p
        WHERE p.slug = ANY($2::text[]) AND p.is_published
          AND (EXISTS (SELECT 1 FROM offer_products op WHERE op.offer_id = $1 AND op.product_id = p.id)
               OR EXISTS (SELECT 1 FROM offer_categories oc WHERE oc.offer_id = $1 AND oc.category_id = p.category_id))
        LIMIT 1`,
      [o.id, slugs],
    );
    return {
      code,
      status: (match ? "valid" : "not_eligible") as PromoStatus,
      offer: summary,
      offerId: o.id,
    };
  }
}

/** Public: active offers for the website header, and a code check for the quotation form. */
@Controller("offers")
export class PublicOffersController {
  constructor(private readonly offers: OffersService) {}

  @Get()
  async list() {
    return { items: await this.offers.listPublic() };
  }

  @Post("validate")
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async validate(@Body() body: ValidateCodeBody) {
    const r = await this.offers.checkCode(body.code, body.productSlugs ?? []);
    return {
      code: r.code,
      status: r.status,
      offer: r.status === "valid" || r.status === "not_eligible" ? r.offer : null,
    };
  }
}

@Controller("admin/offers")
@UseGuards(StaffAuthGuard)
@RequirePermission("offers:write")
export class AdminOffersController {
  constructor(private readonly offers: OffersService) {}

  @Get()
  list() {
    return this.offers.listAdmin();
  }

  @Post()
  create(@Body() body: CreateOfferBody, @CurrentStaff() staff: AuthStaff) {
    return this.offers.create(body, staff);
  }

  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateOfferBody,
    @CurrentStaff() staff: AuthStaff,
  ) {
    return this.offers.update(id, body, staff);
  }

  @Patch(":id/publication")
  @RequirePermission("offers:publish")
  publish(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: PublicationBody,
    @CurrentStaff() staff: AuthStaff,
  ) {
    return this.offers.setPublished(id, body.isPublished, staff);
  }
}
