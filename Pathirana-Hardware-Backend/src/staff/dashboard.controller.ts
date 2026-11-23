import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator";
import type { AuthStaff } from "../auth/auth.service";
import { RequirePermission, roleHas } from "../auth/roles";
import { CurrentStaff, StaffAuthGuard } from "../auth/staff-auth.guard";
import { PageQuery } from "../common/dto";
import { DatabaseService } from "../database/database.service";

type Counts = {
  products: number;
  publishedProducts: number;
  categories: number;
  brands: number;
  activeDeliveryAreas: number;
  newQuotations: number;
  pendingFeedback: number;
};

const ENTITY_TYPES = [
  "staff",
  "category",
  "brand",
  "product",
  "delivery_area",
  "quotation_request",
  "customer_feedback",
  "service",
  "gallery",
  "auth",
  "catalogue",
  "offer",
] as const;

/**
 * GET /api/v1/admin/dashboard — real counts from the database, for admins and editors. Recent
 * activity (audit log) is included ONLY for staff with `audit:view` (admins); for editors the
 * field is not sent at all. No details column is ever returned (it may hold internal values).
 */
@Controller("admin/dashboard")
@UseGuards(StaffAuthGuard)
@RequirePermission("catalogue:write")
export class DashboardController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  async get(@CurrentStaff() staff: AuthStaff) {
    const counts = await this.db.one<Counts>(
      `SELECT
         (SELECT count(*)::int FROM products) AS products,
         (SELECT count(*)::int FROM products WHERE is_published) AS "publishedProducts",
         (SELECT count(*)::int FROM categories) AS categories,
         (SELECT count(*)::int FROM brands) AS brands,
         (SELECT count(*)::int FROM delivery_areas WHERE is_active AND archived_at IS NULL) AS "activeDeliveryAreas",
         (SELECT count(*)::int FROM quotation_requests WHERE status = 'new') AS "newQuotations",
         (SELECT count(*)::int FROM customer_feedback WHERE status = 'pending') AS "pendingFeedback"`,
    );
    if (!roleHas(staff.role, "audit:view")) return { counts };
    const activity = await this.db.query(
      `SELECT a.id::text AS id, a.action, a.entity_type AS "entityType", a.created_at AS "createdAt",
              s.full_name AS "staffName"
         FROM audit_log a LEFT JOIN staff s ON s.id = a.staff_id
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT 8`,
    );
    return { counts, activity };
  }
}

class AuditQuery extends PageQuery {
  @IsOptional() @IsIn(ENTITY_TYPES) entityType?: (typeof ENTITY_TYPES)[number];
  @IsOptional() @IsString() @MaxLength(60) @Matches(/^[a-z0-9.-]+$/) action?: string;
}

/**
 * GET /api/v1/admin/audit-log — the full audit history, newest first (admins only: 401 without a
 * session, 403 for editors). Read-only: entries are never edited or deleted here.
 */
@Controller("admin/audit-log")
@UseGuards(StaffAuthGuard)
@RequirePermission("audit:view")
export class AuditLogController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  async list(@Query() q: AuditQuery) {
    const params: unknown[] = [];
    const where: string[] = [];
    if (q.entityType) {
      params.push(q.entityType);
      where.push(`a.entity_type = $${params.length}`);
    }
    if (q.action) {
      params.push(`${q.action}%`);
      where.push(`a.action LIKE $${params.length}`);
    }
    const sqlWhere = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const rows = await this.db.query<{ total: number }>(
      `SELECT a.id::text AS id, a.action, a.entity_type AS "entityType", a.entity_id::text AS "entityId",
              a.created_at AS "createdAt", s.full_name AS "staffName", count(*) OVER ()::int AS total
         FROM audit_log a LEFT JOIN staff s ON s.id = a.staff_id ${sqlWhere}
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, (q.page - 1) * q.limit],
    );
    return {
      items: rows.map(({ total: _t, ...r }) => r),
      total: rows[0]?.total ?? 0,
      page: q.page,
      limit: q.limit,
    };
  }
}
