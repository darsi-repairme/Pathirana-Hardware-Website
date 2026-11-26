import { Inject, Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { ENV, type Env } from "../config/env";
import { pgConnectionOptions } from "./pg-tls";

export type Queryable = Pick<PoolClient, "query">;

/** Thin wrapper around a pg Pool: parameterised queries and transactions only. */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger("Database");
  readonly pool: Pool;

  constructor(@Inject(ENV) env: Env) {
    this.pool = new Pool({
      ...pgConnectionOptions(env), // TLS with full certificate verification when DATABASE_SSL=true
      // DATABASE_POOL_MAX (default 10): keep the total of all instances under the pooler's limit.
      max: env.DATABASE_POOL_MAX,
      // The database is a long network round trip away (~200 ms; a NEW TLS connection ~1.5 s), so idle
      // connections are kept for 10 minutes instead of 30 s: staff pausing briefly between pages
      // no longer pay a reconnect. TCP keep-alive stops idle connections being dropped silently.
      idleTimeoutMillis: 600_000,
      keepAlive: true,
      connectionTimeoutMillis: 5_000,
      application_name: "pathirana-web-api",
    });
    // Error class only: connection strings never reach the logs.
    this.pool.on("error", (err) => this.logger.error(`Idle client error: ${err.name}`));
  }

  async query<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (await this.pool.query<T>(sql, params)).rows;
  }

  async one<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return (await this.query<T>(sql, params))[0];
  }

  async tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.pool.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
