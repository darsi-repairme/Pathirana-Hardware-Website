/**
 * Supabase Storage buckets for the website (both PRIVATE; the API is the only reader).
 *
 *   npm run storage:setup -- --env-file=.env.supabase                     → report only
 *   npm run storage:setup -- --env-file=.env.supabase --apply --create-buckets
 *
 * Creates ONLY the two missing website buckets. Never modifies, empties or deletes an
 * existing bucket; refuses to continue if a website bucket exists but is public.
 */
import { flag } from "./_db";
import { loadStorageTarget, redactStorage, storageApi, type StorageTarget } from "./_storage";

const LIMIT = "10MB"; // per object; WebP output is far smaller (uploads are capped by MAX_UPLOAD_MB)

interface Bucket {
  id: string;
  name: string;
  public: boolean;
  file_size_limit: number | null;
  allowed_mime_types: string[] | null;
}

let target: StorageTarget | undefined;

async function main() {
  target = loadStorageTarget(flag("env-file") ?? ".env.supabase");
  const list = await storageApi(target, "GET", "/bucket");
  if (!list.ok)
    throw new Error(`Cannot list buckets (HTTP ${list.status}). Check SUPABASE_URL and SUPABASE_SECRET_KEY.`);
  const buckets = (list.json as Bucket[]) ?? [];
  console.log(`Buckets in this project: ${buckets.length}`);
  for (const b of buckets)
    console.log(
      `  ${b.id.padEnd(24)} ${b.public ? "PUBLIC " : "private"} limit=${b.file_size_limit ?? "-"} types=${b.allowed_mime_types?.join(",") ?? "any"}`,
    );

  const wanted = [
    { id: target.catalogueBucket, use: "catalogue media (products, brands, categories)" },
    { id: target.privateBucket, use: "customer quotation photos" },
  ];
  const missing: typeof wanted = [];
  for (const w of wanted) {
    const b = buckets.find((x) => x.id === w.id);
    if (!b) missing.push(w);
    else if (b.public)
      throw new Error(
        `Bucket ${w.id} exists but is PUBLIC. Make it private in the Dashboard (not changed here).`,
      );
    else console.log(`OK: ${w.id} exists and is private (${w.use}).`);
  }
  if (!missing.length) {
    console.log("Both website buckets exist and are private. Nothing to do.");
    return;
  }
  console.log(`Missing: ${missing.map((m) => m.id).join(", ")}`);
  if (!flag("apply") || !flag("create-buckets")) {
    console.log("Report only. Add --apply --create-buckets to create the missing private buckets.");
    return;
  }
  for (const m of missing) {
    const res = await storageApi(target, "POST", "/bucket", {
      id: m.id,
      name: m.id,
      public: false,
      file_size_limit: LIMIT,
      allowed_mime_types: ["image/webp"],
    });
    if (!res.ok) throw new Error(`Creating bucket ${m.id} failed (HTTP ${res.status}).`);
    const check = await storageApi(target, "GET", `/bucket/${m.id}`);
    const b = check.json as Bucket | null;
    if (!check.ok || !b || b.public) throw new Error(`Bucket ${m.id} could not be verified as private.`);
    console.log(`Created: ${m.id} — private, WebP only, ${LIMIT} per object (${m.use}).`);
  }
}

main().catch((e: Error) => {
  console.error(`FAILED: ${redactStorage(e.message, target)}`);
  process.exit(1);
});
