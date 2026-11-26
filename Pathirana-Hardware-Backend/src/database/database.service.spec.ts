import { loadEnv } from "../config/env";
import { DatabaseService } from "./database.service";

/**
 * Regression: a second API instance (security-fix preview) next to the live API exhausted Supabase's
 * session pooler (EMAXCONNSESSION, pool_size 15: 10 + 10 connections), so pages showed
 * "Internal server error". The pool size must be configurable per instance; the default is unchanged.
 */
const base = { DATABASE_URL: "postgres://u:p@127.0.0.1:5432/db", JWT_SECRET: "x".repeat(32) };
const poolMax = (env: Record<string, string>) => {
  const db = new DatabaseService(loadEnv({ ...base, ...env }));
  const max = (db.pool as unknown as { options: { max: number } }).options.max;
  void db.pool.end(); // never connected: nothing to close
  return max;
};

describe("DatabaseService pool size", () => {
  it("keeps 10 connections by default (live behaviour unchanged)", () => {
    expect(poolMax({})).toBe(10);
  });

  it("uses DATABASE_POOL_MAX, so instances can share one pooler limit", () => {
    expect(poolMax({ DATABASE_POOL_MAX: "3" })).toBe(3);
  });

  it("rejects invalid values", () => {
    for (const bad of ["0", "-1", "2.5", "abc", "51"]) {
      expect(() => loadEnv({ ...base, DATABASE_POOL_MAX: bad })).toThrow(/DATABASE_POOL_MAX/);
    }
  });
});
