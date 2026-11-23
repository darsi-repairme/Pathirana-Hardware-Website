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
  /** Optional PEM CA certificate for verifying the database server (e.g. Supabase). Requires DATABASE_SSL=true. */
  DATABASE_SSL_CA_FILE: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined),
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

  // ── Media storage ────────────────────────────────────────────────────────────
  /** "local" = files under UPLOAD_DIR (default); "supabase" = Supabase Storage (private buckets). */
  MEDIA_STORAGE: z.enum(["local", "supabase"]).default("local"),
  /** Project URL, e.g. https://<ref>.supabase.co. */
  SUPABASE_URL: z
    .string()
    .trim()
    .optional()
    .transform((v) => v?.replace(/\/+$/, "") || undefined)
    .refine((v) => v === undefined || /^https?:\/\/[^/\s?#]+$/.test(v), "SUPABASE_URL must be an origin"),
  /** Backend-only secret key (sb_secret_… or legacy service_role). Never sent to a browser. */
  SUPABASE_SECRET_KEY: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined),
  /** Private bucket for catalogue media (products, brands, categories), served only via the API. */
  SUPABASE_CATALOGUE_BUCKET: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/, "bucket names: lowercase letters, digits and hyphens")
    .default("catalogue-media"),
  /** Private bucket for customer quotation photos (staff only). */
  SUPABASE_PRIVATE_BUCKET: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/, "bucket names: lowercase letters, digits and hyphens")
    .default("quotation-photos"),
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
  if (env.DATABASE_SSL_CA_FILE && !env.DATABASE_SSL) {
    throw new Error(
      "Invalid environment configuration:\n  - DATABASE_SSL_CA_FILE: requires DATABASE_SSL=true",
    );
  }
  const mediaIssues = mediaConfigProblems(env);
  if (mediaIssues.length) {
    throw new Error(`Invalid environment configuration:\n${mediaIssues.map((m) => `  - ${m}`).join("\n")}`);
  }
  return env;
}

export const ENV = Symbol("ENV");

/** Supabase Storage needs the project URL (HTTPS; plain HTTP only for a local test server) and the secret key. */
export function mediaConfigProblems(env: Env): string[] {
  if (env.MEDIA_STORAGE !== "supabase") return [];
  const problems: string[] = [];
  if (!env.SUPABASE_URL) problems.push("SUPABASE_URL: required when MEDIA_STORAGE=supabase");
  else {
    const host = new URL(env.SUPABASE_URL).hostname;
    const local = host === "127.0.0.1" || host === "localhost";
    if (!env.SUPABASE_URL.startsWith("https://") && !(local && env.NODE_ENV !== "production"))
      problems.push("SUPABASE_URL: must use https");
  }
  if (!env.SUPABASE_SECRET_KEY || env.SUPABASE_SECRET_KEY.length < 20)
    problems.push("SUPABASE_SECRET_KEY: required when MEDIA_STORAGE=supabase");
  else if (/^sb_publishable_/.test(env.SUPABASE_SECRET_KEY))
    problems.push("SUPABASE_SECRET_KEY: this is a publishable key; use a secret (server-only) key");
  if (env.SUPABASE_CATALOGUE_BUCKET === env.SUPABASE_PRIVATE_BUCKET)
    problems.push("SUPABASE_PRIVATE_BUCKET: must differ from SUPABASE_CATALOGUE_BUCKET");
  return problems;
}
