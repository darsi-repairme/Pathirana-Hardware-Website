import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0"])
  .default("false")
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .refine((v) => /^postgres(ql)?:\/\//.test(v), "DATABASE_URL must be a postgres:// URL"),
  DATABASE_SSL: bool,
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhd]$/, "JWT_EXPIRES_IN must look like 15m, 8h or 1d")
    .default("8h"),
  CORS_ORIGINS: z
    .string()
    .default("")
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .refine((list) => list.every((o) => /^https?:\/\/[^/\s]+$/.test(o)), "CORS_ORIGINS must be origins only"),
  UPLOAD_DIR: z.string().min(1).default("./storage/uploads"),
  MAX_UPLOAD_MB: z.coerce.number().positive().max(20).default(5),
  TRUST_PROXY: bool,
  LOG_LEVEL: z.enum(["error", "warn", "log", "debug", "verbose"]).default("log"),
});

export type Env = z.infer<typeof schema>;

/** Validates process.env once at start-up; refuses to start with unsafe or missing values. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    // Variable names and reasons only, never the values.
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === "production" && env.CORS_ORIGINS.length === 0) {
    throw new Error("Invalid environment configuration:\n  - CORS_ORIGINS: required in production");
  }
  return env;
}

export const ENV = Symbol("ENV");
