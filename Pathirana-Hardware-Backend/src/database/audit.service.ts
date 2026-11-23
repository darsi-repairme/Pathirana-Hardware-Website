import { Injectable } from "@nestjs/common";
import { DatabaseService, type Queryable } from "./database.service";

/** Records admin changes. `details` must never contain passwords or tokens. */
@Injectable()
export class AuditService {
  constructor(private readonly db: DatabaseService) {}

  async log(
    staffId: string | null,
    action: string,
    entityType: string,
    entityId: string | null,
    details: Record<string, unknown> = {},
    client?: Queryable,
  ): Promise<void> {
    const q: Queryable = client ?? this.db.pool;
    await q.query(
      "INSERT INTO audit_log (staff_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)",
      [staffId, action, entityType, entityId, JSON.stringify(details)],
    );
  }
}
