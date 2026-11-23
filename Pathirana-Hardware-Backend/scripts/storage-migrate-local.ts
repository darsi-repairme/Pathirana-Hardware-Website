/**
 * Copies existing LOCAL media files (UPLOAD_DIR from .env) into the private Supabase
 * buckets under the SAME object names, so database references (logo_key, image_key,
 * storage_key) stay exactly as they are — no database change at all.
 *
 *   npm run storage:migrate-local -- --env-file=.env.supabase            → plan only (read-only)
 *   npm run storage:migrate-local -- --env-file=.env.supabase --apply --upload-media
 *
 * Safety: the list of files comes from the database the cloud API uses (read-only);
 * local files are only read (never moved or deleted); uploads are create-only; an
 * object that already exists is skipped when byte-identical and REPORTED (never
 * replaced) when different; every upload is downloaded again and compared (SHA-256).
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import type { MediaArea } from "../src/media/media-storage";
import { connectTarget, flag, loadTarget, redact } from "./_db";
import { loadStorageTarget, redactStorage, storageClient, type StorageTarget } from "./_storage";

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

async function references(envFile: string): Promise<{ area: MediaArea; name: string; ref: string }[]> {
  const db = await connectTarget(loadTarget(envFile), "pathirana-media-migration");
  try {
    await db.query("BEGIN TRANSACTION READ ONLY");
    const q = async (sql: string) => (await db.query<{ k: string; ref: string }>(sql)).rows;
    const out: { area: MediaArea; name: string; ref: string }[] = [];
    for (const r of await q(
      "SELECT logo_key AS k, 'brand ' || name AS ref FROM brands WHERE logo_key IS NOT NULL",
    ))
      out.push({ area: "brands", name: `${r.k}.webp`, ref: r.ref });
    for (const r of await q(
      "SELECT image_key AS k, 'category ' || name AS ref FROM categories WHERE image_key IS NOT NULL",
    ))
      for (const n of [`${r.k}.webp`, `${r.k}-thumb.webp`])
        out.push({ area: "categories", name: n, ref: r.ref });
    for (const r of await q("SELECT storage_key AS k, 'product image ' || id AS ref FROM product_images"))
      for (const n of [`${r.k}.webp`, `${r.k}-thumb.webp`])
        out.push({ area: "products", name: n, ref: r.ref });
    for (const r of await q("SELECT storage_key AS k, 'quotation photo ' || id AS ref FROM quotation_photos"))
      for (const n of [`${r.k}.webp`, `${r.k}-thumb.webp`])
        out.push({ area: "quotations", name: n, ref: r.ref });
    await db.query("ROLLBACK");
    return out;
  } finally {
    await db.end();
  }
}

let target: StorageTarget | undefined;

async function main() {
  const envFile = flag("env-file") ?? ".env.supabase";
  target = loadStorageTarget(envFile);
  const storage = storageClient(target);
  const uploadDir = path.resolve(
    existsSync(".env")
      ? (parseEnv(readFileSync(".env", "utf8")).UPLOAD_DIR ?? "./storage/uploads")
      : "./storage/uploads",
  );
  const apply = flag("apply") === "true" && flag("upload-media") === "true";

  const refs = await references(envFile);
  console.log(`Media referenced by the cloud database: ${refs.length} object(s)`);
  let problems = 0;
  let uploaded = 0;
  for (const r of refs) {
    const bucket = storage.bucketFor(r.area);
    const label = `${bucket}/${r.area}/${r.name} (${r.ref})`;
    const file = path.join(uploadDir, r.area, r.name);
    if (!existsSync(file)) {
      console.log(`  MISSING LOCALLY  ${label}`);
      problems++;
      continue;
    }
    const local = readFileSync(file);
    const remote = await storage.get(r.area, r.name);
    if (remote) {
      if (sha(remote) === sha(local))
        console.log(`  already in cloud, identical (sha256 ${sha(local).slice(0, 12)}…)  ${label}`);
      else {
        console.log(`  DIFFERENT object already in cloud — left untouched  ${label}`);
        problems++;
      }
      continue;
    }
    if (!apply) {
      console.log(`  would upload ${local.length} bytes (sha256 ${sha(local).slice(0, 12)}…)  ${label}`);
      continue;
    }
    await storage.put(r.area, r.name, local);
    const back = await storage.get(r.area, r.name);
    if (!back || sha(back) !== sha(local)) {
      console.log(`  UPLOAD NOT VERIFIED  ${label}`);
      problems++;
      continue;
    }
    uploaded++;
    console.log(
      `  uploaded and verified: ${local.length} bytes, sha256 ${sha(local).slice(0, 12)}… identical  ${label}`,
    );
  }
  console.log(
    apply
      ? `Uploaded ${uploaded}; problems ${problems}. Local files were not changed.`
      : "Plan only: nothing was uploaded.",
  );
  if (problems) process.exitCode = 2;
}

main().catch((e: Error) => {
  console.error(`FAILED: ${redactStorage(redact(e.message), target)}`);
  process.exit(1);
});
