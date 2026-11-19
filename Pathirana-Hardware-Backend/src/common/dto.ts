import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class PageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 24;
}

export class SearchQuery extends PageQuery {
  @IsOptional() @IsString() @MaxLength(80) q?: string;
}

export class StatusBody {
  @IsBoolean() isActive!: boolean;
}

export type Page<T> = { items: T[]; total: number; page: number; limit: number };
