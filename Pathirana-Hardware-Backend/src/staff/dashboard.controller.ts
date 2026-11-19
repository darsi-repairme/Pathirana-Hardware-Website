import { Controller, Get, UseGuards } from "@nestjs/common";
import type { AuthStaff } from "../auth/auth.service";
import { RequirePermission, roleHas } from "../auth/roles";
import { CurrentStaff, StaffAuthGuard } from "../auth/staff-auth.guard";
import { DatabaseService } from "../database/database.service";

type Counts = {
  products: number;
  publishedProducts: number;
  categories: number;
  brands: number;
  activeDeliveryAreas: number;
  newQuotations: number;
};

/**
 * GET /api/v1/admin/dashboard — real counts from the database plus the latest
 * audit-log entries. Editors do not see staff-account events. No details
 * column is returned (it may hold internal values).
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
         (SELECT count(*)::int FROM quotation_requests WHERE status = 'new') AS "newQuotations"`,
    );
    const seesStaff = roleHas(staff.role, "staff:manage");
    const activity = await this.db.query(
      `SELECT a.id::text AS id, a.action, a.entity_type AS "entityType", a.created_at AS "createdAt",
              s.full_name AS "staffName"
         FROM audit_log a LEFT JOIN staff s ON s.id = a.staff_id
        WHERE ($1 OR a.entity_type <> 'staff')
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT 8`,
      [seesStaff],
    );
    return { counts, activity };
  }
}
