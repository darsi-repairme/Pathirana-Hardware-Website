// Security regression tests for the Admin session routes, against the BUILT Admin server and a fake API.
//   Findings covered: forced logout via GET /api/session/expired (3), logout success without
//   revocation (5), and the signed client identity sent to the API (4).
// Run after `next build`:  node --test tests/unit/session-routes.test.mts
//   (ADMIN_DIST_DIR selects the build folder, default .next; ports 4791/4792 must be free.)
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createHmac } from "node:crypto";
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import path from "node:path";
import { after, before, test } from "node:test";

const ADMIN_PORT = 4791;
const API_PORT = 4792;
const ADMIN = `http://127.0.0.1:${ADMIN_PORT}`;
const SECRET = "unit-test-admin-client-secret-0123456789";
const root = path.resolve(import.meta.dirname, "../..");

/** Fake API: answers /auth/me and /auth/logout with configurable statuses; records headers. */
const fake = { me: 200, logout: 204, seen: [] as { url: string; headers: IncomingHttpHeaders }[] };
let api: Server;
let admin: ChildProcess;

before(async () => {
  api = createServer((req, res) => {
    fake.seen.push({ url: req.url ?? "", headers: req.headers });
    const send = (status: number, body?: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(body === undefined ? undefined : JSON.stringify(body));
    };
    if (req.url === "/api/v1/auth/me") {
      return fake.me === 200
        ? send(200, {
            id: "11111111-1111-4111-8111-111111111111",
            email: "a@test.invalid",
            fullName: "A",
            role: "admin",
          })
        : send(fake.me, { message: "x" });
    }
    if (req.url === "/api/v1/auth/logout") return send(fake.logout, fake.logout === 204 ? undefined : { message: "x" });
    if (req.url === "/api/v1/auth/login") {
      return send(200, { accessToken: "fresh.jwt.token", staff: { email: "a@test.invalid" } });
    }
    send(404, { message: "not found" });
  });
  await new Promise<void>((r) => api.listen(API_PORT, "127.0.0.1", r));
  admin = spawn(
    process.execPath,
    [path.join(root, "node_modules/next/dist/bin/next"), "start", "-p", String(ADMIN_PORT), "-H", "127.0.0.1"],
    {
      cwd: root,
      env: {
        ...process.env,
        NODE_ENV: "production",
        BACKEND_API_URL: `http://127.0.0.1:${API_PORT}`,
        ADMIN_COOKIE_SECURE: "false",
        ADMIN_TRUST_PROXY: "false",
        ADMIN_CLIENT_SECRET: SECRET,
      },
      stdio: "ignore",
    },
  );
  const end = Date.now() + 60_000;
  for (;;) {
    try {
      if ((await fetch(`${ADMIN}/login`, { redirect: "manual" })).status < 500) break;
    } catch {}
    if (Date.now() > end) throw new Error("Admin did not start");
    await new Promise((r) => setTimeout(r, 300));
  }
});
after(async () => {
  admin?.kill();
  await new Promise((r) => api?.close(r));
});

const SESSION = "ph_admin_session=valid.jwt.token";
const cleared = (res: Response) =>
  res.headers.getSetCookie().some((c) => /^ph_admin_session=;/.test(c) && /Max-Age=0/i.test(c));
const expired = (headers: Record<string, string>) =>
  fetch(`${ADMIN}/api/session/expired?next=/products`, { redirect: "manual", headers });

// ── Finding 3: GET /api/session/expired ──────────────────────────────────────
test("cross-site navigation cannot clear the session (even if it carried the cookie)", async () => {
  fake.me = 401; // even an invalid session is left alone for a foreign navigation
  for (const site of ["cross-site", "same-site"]) {
    const res = await expired({ Cookie: SESSION, "Sec-Fetch-Site": site });
    assert.equal(res.status, 307);
    assert.equal(cleared(res), false, site);
    assert.match(res.headers.get("location") ?? "", /\/login\?expired=1&next=%2Fproducts$/);
  }
});

test("a valid session is kept and the person continues to the page", async () => {
  fake.me = 200;
  const res = await expired({ Cookie: SESSION, "Sec-Fetch-Site": "same-origin" });
  assert.equal(cleared(res), false);
  assert.match(res.headers.get("location") ?? "", /\/products$/);
});

test("API unreachable/busy: the session is kept (no sign-out on an outage)", async () => {
  for (const status of [429, 500]) {
    fake.me = status;
    const res = await expired({ Cookie: SESSION, "Sec-Fetch-Site": "same-origin" });
    assert.equal(cleared(res), false, String(status));
  }
});

test("a real expired session (API 401) from this site is cleared and shows the sign-in page", async () => {
  fake.me = 401;
  for (const site of ["same-origin", "none"]) {
    const res = await expired({ Cookie: SESSION, "Sec-Fetch-Site": site });
    assert.equal(cleared(res), true, site);
    assert.match(res.headers.get("location") ?? "", /\/login\?expired=1&next=%2Fproducts$/);
  }
  const noCookie = await expired({ "Sec-Fetch-Site": "same-origin" });
  assert.match(noCookie.headers.get("location") ?? "", /\/login\?expired=1/);
});

// ── Finding 5: DELETE /api/session ──────────────────────────────────────────
const logout = (cookie = SESSION) =>
  fetch(`${ADMIN}/api/session`, { method: "DELETE", headers: { Cookie: cookie, Origin: ADMIN, "x-ph-admin": "1" } });

test("logout reports success only when the API revoked the session", async () => {
  fake.logout = 204;
  const ok = await logout();
  assert.equal(ok.status, 204);
  assert.equal(cleared(ok), true);
});

test("already invalid/revoked token (401/403): signed out, success", async () => {
  for (const status of [401, 403]) {
    fake.logout = status;
    const res = await logout();
    assert.equal(res.status, 204, String(status));
    assert.equal(cleared(res), true);
  }
});

test("API 429 / 500: NOT reported as success; cookie still cleared on this device", async () => {
  for (const status of [429, 500, 502]) {
    fake.logout = status;
    const res = await logout();
    assert.equal(res.status, 503, String(status));
    const body = (await res.json()) as { revoked: boolean; message: string };
    assert.equal(body.revoked, false);
    assert.doesNotMatch(body.message, /jwt|token|stack|ECONN/i);
    assert.equal(cleared(res), true);
  }
});

test("API unreachable: NOT reported as success", async () => {
  fake.logout = 204;
  await new Promise((r) => api.close(r));
  try {
    const res = await logout();
    assert.equal(res.status, 503);
    assert.equal(((await res.json()) as { revoked: boolean }).revoked, false);
    assert.equal(cleared(res), true);
  } finally {
    await new Promise<void>((r) => api.listen(API_PORT, "127.0.0.1", r));
  }
});

test("logout still requires the same-origin CSRF header", async () => {
  const res = await fetch(`${ADMIN}/api/session`, {
    method: "DELETE",
    headers: { Cookie: SESSION, Origin: "https://evil.test" },
  });
  assert.equal(res.status, 403);
});

// ── Finding 4: signed client identity sent to the API ───────────────────────
test("sign-in remembers the device; later API calls carry its signed identity, never forged ones", async () => {
  const login = await fetch(`${ADMIN}/api/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: ADMIN,
      "X-PH-Client": "dev:forged_forged_forged_1",
      "X-PH-Client-Sig": "0".repeat(64),
    },
    body: JSON.stringify({ email: "a@test.invalid", password: "whatever-password" }),
  });
  assert.equal(login.status, 200);
  const device = login.headers.getSetCookie().find((c) => c.startsWith("ph_admin_device="));
  assert.ok(device, "device cookie set");
  assert.match(device!, /HttpOnly/i);
  assert.match(device!, /SameSite=Strict/i);
  // The forged client headers from the browser were not passed on.
  const sentAtLogin = fake.seen.findLast((s) => s.url === "/api/v1/auth/login")!;
  assert.equal(sentAtLogin.headers["x-ph-client"], undefined);

  fake.me = 200;
  fake.seen.length = 0;
  const cookie = `${SESSION}; ${device!.split(";")[0]}`;
  await expired({ Cookie: cookie, "Sec-Fetch-Site": "same-origin" });
  const me = fake.seen.find((s) => s.url === "/api/v1/auth/me")!;
  const id = me.headers["x-ph-client"] as string;
  assert.match(id, /^dev:[A-Za-z0-9_-]{32}$/);
  assert.equal(me.headers["x-ph-client-sig"], createHmac("sha256", SECRET).update(`ph-client-v1:${id}`).digest("hex"));
  // Without a trusted proxy, client-supplied X-Forwarded-For is not passed on.
  assert.equal(me.headers["x-forwarded-for"], undefined);

  // A tampered device cookie is ignored.
  fake.seen.length = 0;
  await expired({
    Cookie: `${SESSION}; ph_admin_device=${"A".repeat(32)}.${"0".repeat(64)}`,
    "Sec-Fetch-Site": "same-origin",
    "X-Forwarded-For": "6.6.6.6",
  });
  const me2 = fake.seen.find((s) => s.url === "/api/v1/auth/me")!;
  assert.equal(me2.headers["x-ph-client"], undefined);
  assert.equal(me2.headers["x-forwarded-for"], undefined);
});
