import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import type { AuthStaff } from "../auth/auth.service";
import { RequirePermission } from "../auth/roles";
import { CurrentStaff, StaffAuthGuard } from "../auth/staff-auth.guard";
import { StatusBody } from "../common/dto";
import { likePattern, normaliseSearch } from "../common/text";
import { AREA_TEXT, AreaTranslations, cleanTranslations } from "../common/translations";
import { buildUpdate } from "../common/update";
import { AuditService } from "../database/audit.service";
import { DatabaseService } from "../database/database.service";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value;
/** Empty strings clear optional fields. */
const trimOrNull = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") || null : value;

export class CreateDeliveryAreaBody {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(80)
  district?: string | null;
  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_, v) => v !== null)
  @Matches(/^[0-9]{5}$/, {
    message: "postalCode must be a 5-digit Sri Lankan postal code",
  })
  postalCode?: string | null;
  @IsOptional() @Transform(trimOrNull) @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(500) notes?:
    string | null;
  /** Owner-approved delivery fee in LKR; omit or null when not approved. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  feeLkr?: number | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
  /** Staff-entered Tamil / Sinhala area name and notes (migration 0006). */
  @IsOptional() @IsObject() @ValidateNested() @Type(() => AreaTranslations) translations?: AreaTranslations;
}

export class UpdateDeliveryAreaBody {
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(80)
  district?: string | null;
  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_, v) => v !== null)
  @Matches(/^[0-9]{5}$/, {
    message: "postalCode must be a 5-digit Sri Lankan postal code",
  })
  postalCode?: string | null;
  @IsOptional() @Transform(trimOrNull) @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(500) notes?:
    string | null;
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  feeLkr?: number | null;
  /** Replaces all translations of this area. */
  @IsOptional() @IsObject() @ValidateNested() @Type(() => AreaTranslations) translations?: AreaTranslations;
}

export class RestoreDeliveryAreaBody {
  /** Show the restored area to customers straight away (default) or keep it inactive. */
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class PublicAreaQuery {
  @IsOptional() @IsString() @MaxLength(80) q?: string;
}

class CheckQuery {
  @IsString() @MinLength(1) @MaxLength(80) area!: string;
}

class AdminAreaQuery {
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  includeArchived?: boolean;
}

/**
 * Public view: no internal IDs beyond the area id, no staff data and NO delivery
 * charges (the public website shows none; the fee stays a staff-only field).
 */
const PUBLIC_COLUMNS = `id, name, district, postal_code AS "postalCode", notes, translations`;
/** A translated area name (either locale) also matches. */
const TRANSLATED_NAME = (op: string, v: string) =>
  `lower(translations->'ta'->>'name') ${op} ${v} OR lower(translations->'si'->>'name') ${op} ${v}`;
const ADMIN_COLUMNS = `${PUBLIC_COLUMNS},
  CASE WHEN fee_lkr IS NULL THEN NULL ELSE fee_lkr::float8 END AS "feeLkr",
  is_active AS "isActive", archived_at AS "archivedAt", created_at AS "createdAt", updated_at AS "updatedAt"`;
const LISTED = "is_active AND archived_at IS NULL";

@Injectable()
export class DeliveryAreasService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  /** Active areas, optionally filtered by name, district or postal code. Empty until staff add areas. */
  async listPublic(q?: string) {
    const term = q ? normaliseSearch(q) : "";
    const items = await this.db.query(
      `SELECT ${PUBLIC_COLUMNS} FROM delivery_areas
        WHERE ${LISTED} AND ($1 = '' OR name ILIKE $2 OR district ILIKE $2 OR postal_code = $1
                             OR ${TRANSLATED_NAME("LIKE", "lower($2)")})
        ORDER BY name LIMIT 200`,
      [term, likePattern(term)],
    );
    return { items, total: items.length };
  }

  /**
   * Is this area supported? Exact match on area name (case/space-insensitive)
   * or postal code, among active areas. `areasListed` tells the caller whether
   * any areas exist yet, so it can answer honestly when none are listed.
   */
  async check(area: string) {
    const term = normaliseSearch(area);
    const match = await this.db.one(
      `SELECT ${PUBLIC_COLUMNS} FROM delivery_areas
        WHERE ${LISTED} AND (lower(regexp_replace(trim(name), '\\s+', ' ', 'g')) = $1 OR postal_code = $1
                             OR ${TRANSLATED_NAME("=", "$1")})
        ORDER BY name LIMIT 1`,
      [term],
    );
    const listed = await this.db.one<{ n: number }>(
      `SELECT count(*)::int AS n FROM delivery_areas WHERE ${LISTED}`,
    );
    return {
      query: area.trim(),
      supported: Boolean(match),
      area: match ?? null,
      areasListed: (listed?.n ?? 0) > 0,
    };
  }

  listAll(includeArchived = false) {
    return this.db.query(
      `SELECT ${ADMIN_COLUMNS} FROM delivery_areas ${includeArchived ? "" : "WHERE archived_at IS NULL"}
        ORDER BY archived_at NULLS FIRST, name`,
    );
  }

  async create(body: CreateDeliveryAreaBody, staff: AuthStaff) {
    const row = await this.db.one<{ id: string }>(
      `INSERT INTO delivery_areas (name, district, postal_code, notes, fee_lkr, is_active, translations)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${ADMIN_COLUMNS}`,
      [
        body.name,
        body.district ?? null,
        body.postalCode ?? null,
        body.notes ?? null,
        body.feeLkr ?? null,
        body.isActive ?? true,
        JSON.stringify(cleanTranslations(body.translations, AREA_TEXT)),
      ],
    );
    await this.audit.log(staff.id, "delivery-area.create", "delivery_area", row!.id, { name: body.name });
    return row;
  }

  async update(id: string, body: UpdateDeliveryAreaBody, staff: AuthStaff) {
    const { set, params, changed } = buildUpdate(
      {
        ...body,
        translations:
          body.translations === undefined
            ? undefined
            : JSON.stringify(cleanTranslations(body.translations, AREA_TEXT)),
      },
      {
        name: "name",
        district: "district",
        postalCode: "postal_code",
        notes: "notes",
        feeLkr: "fee_lkr",
        translations: "translations",
      },
    );
    const row = await this.db.one(
      `UPDATE delivery_areas SET ${set} WHERE id = $1 AND archived_at IS NULL RETURNING ${ADMIN_COLUMNS}`,
      [id, ...params],
    );
    if (!row) throw new NotFoundException("Delivery area not found.");
    await this.audit.log(staff.id, "delivery-area.update", "delivery_area", id, { changed });
    return row;
  }

  async setActive(id: string, isActive: boolean, staff: AuthStaff) {
    const row = await this.db.one(
      `UPDATE delivery_areas SET is_active = $2 WHERE id = $1 AND archived_at IS NULL RETURNING ${ADMIN_COLUMNS}`,
      [id, isActive],
    );
    if (!row) throw new NotFoundException("Delivery area not found.");
    await this.audit.log(
      staff.id,
      isActive ? "delivery-area.activate" : "delivery-area.deactivate",
      "delivery_area",
      id,
    );
    return row;
  }

  /** Safe delete: archives (hidden everywhere, kept for history; the name can be reused). */
  async archive(id: string, staff: AuthStaff) {
    const row = await this.db.one(
      "UPDATE delivery_areas SET archived_at = now(), is_active = false WHERE id = $1 AND archived_at IS NULL RETURNING id",
      [id],
    );
    if (!row) throw new NotFoundException("Delivery area not found.");
    await this.audit.log(staff.id, "delivery-area.archive", "delivery_area", id);
  }

  /**
   * Undo an archive on the SAME record (its id and history are kept; nothing is
   * duplicated). Refused when a current area already uses the same name and
   * district — the existing unique index enforces that, even under races.
   */
  async restore(id: string, isActive: boolean, staff: AuthStaff) {
    let row: { name: string } | null | undefined;
    try {
      row = await this.db.one<{ name: string }>(
        `UPDATE delivery_areas SET archived_at = NULL, is_active = $2
          WHERE id = $1 AND archived_at IS NOT NULL RETURNING ${ADMIN_COLUMNS}`,
        [id, isActive],
      );
    } catch (err) {
      if ((err as { code?: string }).code === "23505") {
        throw new ConflictException(
          "A current delivery area already uses this name. Archive or rename that area first, then restore this one.",
        );
      }
      throw err;
    }
    if (!row) {
      const exists = await this.db.one("SELECT 1 FROM delivery_areas WHERE id = $1", [id]);
      if (exists) throw new ConflictException("This delivery area is not archived.");
      throw new NotFoundException("Delivery area not found.");
    }
    await this.audit.log(staff.id, "delivery-area.restore", "delivery_area", id, {
      name: row.name,
      isActive,
    });
    return row;
  }
}

@Controller("delivery-areas")
export class PublicDeliveryAreasController {
  constructor(private readonly areas: DeliveryAreasService) {}

  @Get()
  list(@Query() q: PublicAreaQuery) {
    return this.areas.listPublic(q.q);
  }

  @Get("check")
  check(@Query() q: CheckQuery) {
    return this.areas.check(q.area);
  }
}

@Controller("admin/delivery-areas")
@UseGuards(StaffAuthGuard)
@RequirePermission("delivery-areas:write")
export class AdminDeliveryAreasController {
  constructor(private readonly areas: DeliveryAreasService) {}

  @Get()
  async list(@Query() q: AdminAreaQuery) {
    return { items: await this.areas.listAll(q.includeArchived) };
  }

  @Post()
  create(@Body() body: CreateDeliveryAreaBody, @CurrentStaff() staff: AuthStaff) {
    return this.areas.create(body, staff);
  }

  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateDeliveryAreaBody,
    @CurrentStaff() staff: AuthStaff,
  ) {
    return this.areas.update(id, body, staff);
  }

  @Patch(":id/status")
  setStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: StatusBody,
    @CurrentStaff() staff: AuthStaff,
  ) {
    return this.areas.setActive(id, body.isActive, staff);
  }

  @Delete(":id")
  @HttpCode(204)
  async archive(@Param("id", ParseUUIDPipe) id: string, @CurrentStaff() staff: AuthStaff) {
    await this.areas.archive(id, staff);
  }

  /** Admin-only (overrides the controller's editor-level permission). */
  @Post(":id/restore")
  @HttpCode(200)
  @RequirePermission("delivery-areas:restore")
  restore(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: RestoreDeliveryAreaBody,
    @CurrentStaff() staff: AuthStaff,
  ) {
    return this.areas.restore(id, body.isActive ?? true, staff);
  }
}

@Module({
  controllers: [PublicDeliveryAreasController, AdminDeliveryAreasController],
  providers: [DeliveryAreasService],
})
export class DeliveryAreasModule {}
