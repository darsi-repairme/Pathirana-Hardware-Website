import { createServer, type IncomingMessage, type Server } from "node:http";

/**
 * Local stand-in for the Supabase Storage REST API (the subset the API uses), for
 * integration tests only. Behaves like PRIVATE buckets: objects are readable only with
 * the secret key via /object/authenticated; /object/public/... is always refused.
 * Mirrors Supabase's error shapes (duplicate → 400 with statusCode "409", missing → 400
 * with statusCode "404").
 */
export class FakeSupabaseStorage {
  readonly objects = new Map<string, Buffer>(); // "<bucket>/<path>"
  readonly seenHeaders: Record<string, string | string[] | undefined>[] = [];
  down = false;
  private server?: Server;
  url = "";

  constructor(
    readonly secretKey: string,
    readonly buckets: string[],
  ) {}

  async start() {
    this.server = createServer((req, res) => {
      void this.handle(req).then(({ status, body, type }) => {
        res.writeHead(status, { "content-type": type ?? "application/json" });
        res.end(body);
      });
    });
    await new Promise<void>((r) => this.server!.listen(0, "127.0.0.1", r));
    this.url = `http://127.0.0.1:${(this.server!.address() as { port: number }).port}`;
  }

  async stop() {
    await new Promise((r) => this.server?.close(r));
  }

  inBucket(bucket: string) {
    return [...this.objects.keys()]
      .filter((k) => k.startsWith(`${bucket}/`))
      .map((k) => k.slice(bucket.length + 1));
  }

  private async handle(
    req: IncomingMessage,
  ): Promise<{ status: number; body: string | Buffer; type?: string }> {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = Buffer.concat(chunks);
    this.seenHeaders.push(req.headers);
    const err = (status: number, code: string, message: string) => ({
      status,
      body: JSON.stringify({ statusCode: code, error: message, message }),
    });
    if (this.down) return err(503, "503", "Service Unavailable");
    const url = new URL(req.url ?? "/", "http://x");
    const m = url.pathname.match(/^\/storage\/v1\/object\/(authenticated\/|public\/)?([^/]+)(?:\/(.+))?$/);
    if (!m) return err(404, "404", "route not found");
    const [, mode, bucket, objectPath] = m;
    if (mode === "public/") return err(400, "404", "Bucket not found"); // private buckets: no public URLs
    if (req.headers.apikey !== this.secretKey) return err(403, "403", "Invalid key");
    if (!this.buckets.includes(bucket!)) return err(400, "404", "Bucket not found");
    const key = `${bucket}/${objectPath}`;
    if (req.method === "POST" && objectPath && !mode) {
      if (this.objects.has(key) && req.headers["x-upsert"] !== "true")
        return err(400, "409", "Duplicate: The resource already exists");
      this.objects.set(key, body);
      return { status: 200, body: JSON.stringify({ Key: key }) };
    }
    if (req.method === "GET" && mode === "authenticated/" && objectPath) {
      const data = this.objects.get(key);
      return data ? { status: 200, body: data, type: "image/webp" } : err(400, "404", "Object not found");
    }
    if (req.method === "DELETE" && !objectPath) {
      const { prefixes } = JSON.parse(body.toString() || "{}") as { prefixes: string[] };
      for (const p of prefixes) this.objects.delete(`${bucket}/${p}`);
      return { status: 200, body: "[]" };
    }
    return err(400, "400", "unsupported");
  }
}
