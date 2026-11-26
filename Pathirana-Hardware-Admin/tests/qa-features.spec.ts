/**
 * Audit Log filters, product save feedback, Change Password (show/hide + messages), Owner code
 * format and sign-in rejection — against the isolated stack (tests/stack.ts). Disposable data only.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { API_PORT, BACKEND_DIR, STAFF } from "./stack";

type PgModule = {
  Client: new (o: { connectionString?: string }) => {
    connect(): Promise<void>;
    query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
    end(): Promise<void>;
  };
};
const req = createRequire(path.join(BACKEND_DIR, "package.json"));
const pg = req("pg") as PgModule;
const { hashPassword } = req("./dist/auth/password.js") as { hashPassword: (p: string) => Promise<string> };
const AUTH = path.resolve(__dirname, ".auth");
const API = `http://127.0.0.1:${API_PORT}`;

async function db<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const c = new pg.Client({ connectionString: process.env.E2E_DB_URL });
  await c.connect();
  try {
    return (await c.query(sql, params)).rows as T[];
  } finally {
    await c.end();
  }
}

let ipSeq = 0;
test.beforeEach(async ({ page }, info) => {
  ipSeq += 1;
  await page.setExtraHTTPHeaders({ "X-Forwarded-For": `10.${info.project.name === "mobile" ? 41 : 40}.${ipSeq}.1` });
});

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password *", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
}

test.describe("Audit Log filters", () => {
  test.use({ storageState: path.join(AUTH, "admin.json") });

  test("person, action, date range, clear, and paging that restarts at page 1", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "writes audit rows: run once");
    const [admin, editor] = await Promise.all(
      [STAFF.admin.email, STAFF.editor.email].map(
        async (e) => (await db<{ id: string }>("SELECT id FROM staff WHERE email = $1", [e]))[0]!.id,
      ),
    );
    // 2019: far from anything the other tests record. 30 admin gallery entries in May (2 pages of 25),
    // and one editor entry on 10 May.
    for (let i = 0; i < 30; i++) {
      await db(
        "INSERT INTO audit_log (staff_id, action, entity_type, created_at) VALUES ($1, 'gallery.add', 'gallery', $2)",
        [admin, `2019-05-${String(1 + (i % 28)).padStart(2, "0")}T06:00:00Z`],
      );
    }
    await db(
      "INSERT INTO audit_log (staff_id, action, entity_type, created_at) VALUES ($1, 'product.update', 'product', '2019-05-10T06:00:00Z')",
      [editor],
    );

    await page.goto("/audit-log");
    const count = page.locator("[data-audit-filters] p[aria-live]");
    await expect(count).toContainText("entries");
    await expect(page.getByRole("button", { name: "Clear filters" })).toBeDisabled();

    await page.getByLabel("From").fill("2019-05-01");
    await page.getByLabel("To").fill("2019-05-31");
    await expect(count).toContainText("31 entries match these filters");
    await page.getByLabel("Person").selectOption({ label: `${STAFF.admin.name} (${STAFF.admin.email})` });
    await expect(count).toContainText("30 entries match these filters");
    await expect(page.getByRole("navigation", { name: "Pagination" })).toContainText("Page 1 of 2 · 30 total");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("navigation", { name: "Pagination" })).toContainText("Page 2 of 2");
    await expect(page.locator("[data-audit-log] tr")).toHaveCount(5);
    // Changing a filter goes back to page 1.
    await page.getByLabel("Person").selectOption({ label: `${STAFF.editor.name} (${STAFF.editor.email})` });
    await expect(count).toContainText("1 entry match these filters");
    await expect(page.locator("[data-audit-log] tr")).toHaveCount(1);
    await expect(page.locator("[data-audit-log]")).toContainText(STAFF.editor.name);
    await expect(page.locator("[data-audit-log]")).not.toContainText(STAFF.admin.name);
    // Action filter (grouped by area); an action of another person: empty state.
    await page.getByLabel("Action").selectOption({ label: "Added a gallery photo" });
    await expect(page.getByText("No matching activity.")).toBeVisible();
    await page.getByLabel("Person").selectOption({ label: "All people" });
    await expect(count).toContainText("30 entries match these filters");
    // Single day.
    await page.getByLabel("From").fill("2019-05-10");
    await page.getByLabel("To").fill("2019-05-10");
    await page.getByLabel("Action").selectOption({ label: "All actions" });
    await expect(count).toContainText("2 entries match these filters"); // 1 gallery (10 May) + 1 product
    // Reversed range: explained, nothing loaded.
    await page.getByLabel("From").fill("2019-05-20");
    await expect(page.locator("#audit-range-error[role=alert]")).toHaveText(
      "The start date must be on or before the end date.",
    );
    await expect(page.locator("[data-audit-log]")).toHaveCount(0);
    // Clear: everything again.
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByLabel("From")).toHaveValue("");
    await expect(page.getByLabel("Person")).toHaveValue("");
    await expect(count).not.toContainText("match these filters");
    await expect(page.getByRole("button", { name: "Clear filters" })).toBeDisabled();
  });
});

test.describe("Product save feedback (editor)", () => {
  test.use({ storageState: path.join(AUTH, "editor.json") });

  test("network failure, server validation, one product per Save, edit confirmation", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "creates products: run once");
    const category = "QA Save Feedback Category";
    const name = "QA Save Feedback Product";
    await db("INSERT INTO categories (name, slug) VALUES ($1, 'qa-save-feedback-category') ON CONFLICT DO NOTHING", [
      category,
    ]);
    const products = async () =>
      (await db<{ n: number }>("SELECT count(*)::int AS n FROM products WHERE name = $1", [name]))[0]!.n;

    await page.goto("/products/new");
    await page.getByLabel("Product name").fill(name);
    await page.getByRole("combobox", { name: /^Category/ }).selectOption({ label: category });
    await page.getByLabel("Short summary").fill("Isolated test product.");
    const save = page.getByRole("button", { name: "Create Product" });

    // Network failure: an error, no success, nothing saved; the message is scrolled into view.
    await page.route("**/api/backend/admin/products", (r) =>
      r.request().method() === "POST" ? r.abort("failed") : r.continue(),
    );
    await save.click();
    const alert = page.locator("main [role=alert]").first();
    await expect(alert).toHaveText("Unable to save product. Please try again.");
    await expect(alert).toBeInViewport();
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(page).toHaveURL(/\/products\/new$/);
    await page.unroute("**/api/backend/admin/products");

    // Server-side validation error: its details are listed, no success.
    await page.route("**/api/backend/admin/products", (r) =>
      r.request().method() === "POST"
        ? r.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({ message: ["price must be a positive number"] }),
          })
        : r.continue(),
    );
    await save.click();
    await expect(alert).toContainText("Please correct the highlighted details.");
    await expect(alert).toContainText("price must be a positive number");
    await page.unroute("**/api/backend/admin/products");
    expect(await products()).toBe(0);

    // Save pressed repeatedly: exactly one product, then the list confirms it.
    await save.dblclick();
    await expect(page).toHaveURL(/\/products\?created=/);
    await expect(page.getByRole("status").first()).toContainText(`Product “${name}” added successfully.`);
    expect(await products()).toBe(1);

    // Edit → Save Changes → confirmation after the API saved it.
    await page
      .getByRole("link", { name: `Edit ${name}` })
      .first()
      .click();
    await page.getByLabel("Short summary").fill("Isolated test product, edited.");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page).toHaveURL(/\/products\?saved=/);
    await expect(page.getByRole("status").first()).toContainText(`Product changes to “${name}” saved successfully.`);
    expect((await db<{ summary: string }>("SELECT summary FROM products WHERE name = $1", [name]))[0]!.summary).toBe(
      "Isolated test product, edited.",
    );
  });
});

test.describe("Change Password", () => {
  test("show/hide on all three fields; errors; success signs out and only the new password works", async ({
    page,
    request,
  }, info) => {
    test.skip(info.project.name !== "desktop", "changes a password: run once (mobile checks the toggles below)");
    const email = "qa-password-change@test.invalid";
    const oldPw = "Old-Password-For-QA-1";
    const newPw = "New-Password-For-QA-2";
    await db("DELETE FROM staff WHERE email = $1", [email]);
    await db("INSERT INTO staff (email, full_name, role, password_hash) VALUES ($1, 'QA Password', 'editor', $2)", [
      email,
      await hashPassword(oldPw),
    ]);
    await signIn(page, email, oldPw);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/settings");

    const current = page.getByRole("textbox", { name: "Current password *", exact: true });
    const next = page.getByRole("textbox", { name: "New password *", exact: true });
    const confirm = page.getByRole("textbox", { name: "Repeat new password *", exact: true });
    const toggles = page.locator("form").getByRole("button", { name: /^(Show|Hide) password$/ });
    await expect(toggles).toHaveCount(3);
    for (const f of [current, next, confirm]) await expect(f).toHaveAttribute("type", "password");

    // Each toggle controls only its own field, keeps the text and never submits the form.
    await next.fill("typed-text-stays");
    await toggles.nth(1).click();
    await expect(next).toHaveAttribute("type", "text");
    await expect(next).toHaveValue("typed-text-stays");
    await expect(current).toHaveAttribute("type", "password");
    await expect(confirm).toHaveAttribute("type", "password");
    await expect(toggles.nth(1)).toHaveAccessibleName("Hide password");
    await expect(toggles.nth(1)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("form [role=alert]")).toHaveCount(0);
    await toggles.nth(1).click();
    await expect(next).toHaveAttribute("type", "password");
    // Keyboard: Tab from the field reaches its toggle; Space toggles it.
    await current.focus();
    await page.keyboard.press("Tab");
    await expect(toggles.nth(0)).toBeFocused();
    await page.keyboard.press("Space");
    await expect(current).toHaveAttribute("type", "text");
    await page.keyboard.press("Space");
    // The icon sits inside the field without covering the text.
    const [fieldBox, iconBox] = [await next.boundingBox(), await toggles.nth(1).boundingBox()];
    expect(iconBox!.x).toBeGreaterThan(fieldBox!.x + fieldBox!.width / 2);
    expect(iconBox!.x + iconBox!.width).toBeLessThanOrEqual(fieldBox!.x + fieldBox!.width);
    expect(await next.evaluate((e) => parseFloat(getComputedStyle(e).paddingRight))).toBeGreaterThanOrEqual(
      iconBox!.width,
    );

    const submit = page.getByRole("button", { name: "Change Password" });
    // Missing fields / mismatch / too short: shown before any request.
    await next.fill("");
    await submit.click();
    await expect(page.getByText("Enter your current password.")).toBeVisible();
    await current.fill(oldPw);
    await next.fill("short");
    await confirm.fill("different");
    await submit.click();
    await expect(page.getByText("Use at least 12 characters.")).toBeVisible();
    await expect(page.getByText("The new passwords do not match.")).toBeVisible();
    // Wrong current password (from the API).
    await current.fill("Not-The-Current-Password");
    await next.fill(newPw);
    await confirm.fill(newPw);
    await submit.click();
    await expect(page.locator("form [role=alert]")).toContainText("The current password is incorrect.");
    // Same as the current one (API policy).
    await current.fill(oldPw);
    await next.fill(oldPw);
    await confirm.fill(oldPw);
    await submit.click();
    await expect(page.locator("form [role=alert]")).toContainText("Choose a password different from the current one.");
    // Network failure: an error, not a success.
    await page.route("**/api/backend/auth/password", (r) => r.abort("failed"));
    await next.fill(newPw);
    await confirm.fill(newPw);
    await submit.click();
    await expect(page.locator("form [role=alert]")).toContainText("Unable to change password. Please try again.");
    await page.unroute("**/api/backend/auth/password");
    expect(page.url()).toMatch(/\/settings$/);

    // Success: confirmed, signed out everywhere; only the new password signs in.
    await submit.click();
    await expect(page).toHaveURL(/\/login\?passwordChanged=1$/);
    await expect(page.getByRole("status")).toContainText("Password changed successfully.");
    const attempt = (password: string, ip: string) =>
      request.post(`${API}/api/v1/auth/login`, { headers: { "X-Forwarded-For": ip }, data: { email, password } });
    expect((await attempt(oldPw, "10.42.0.1")).status()).toBe(401);
    expect((await attempt(newPw, "10.42.0.2")).status()).toBe(200);
  });

  test("toggles work on phones too (touch targets inside the field)", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: path.join(AUTH, "admin.json") });
    const page = await ctx.newPage();
    await page.goto("/settings");
    const toggles = page.locator("form").getByRole("button", { name: /^(Show|Hide) password$/ });
    await expect(toggles).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      const box = (await toggles.nth(i).boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(40);
      await toggles
        .nth(i)
        .tap()
        .catch(() => toggles.nth(i).click());
      await expect(toggles.nth(i)).toHaveAccessibleName("Hide password");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await ctx.close();
  });
});

/** WCAG contrast ratio of an element's text against the nearest opaque background (rendered colours). */
async function contrastOf(page: Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const rgba = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
      const lum = ([r, g, b]: number[]) => {
        const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
      };
      let bg: number[] = [255, 255, 255];
      for (let n: Element | null = el; n; n = n.parentElement) {
        const c = rgba(getComputedStyle(n).backgroundColor);
        if (c.length >= 3 && (c[3] ?? 1) === 1) {
          bg = c;
          break;
        }
      }
      const fg = rgba(getComputedStyle(el).color);
      const a = fg[3] ?? 1;
      const mixed = [0, 1, 2].map((i) => fg[i]! * a + bg[i]! * (1 - a));
      const [l1, l2] = [lum(mixed), lum(bg)].sort((x, y) => y - x);
      return (l1! + 0.05) / (l2! + 0.05);
    });
}

test.describe("Accessibility fixes (audit A11Y-02, A11Y-03, A11Y-04)", () => {
  test.use({ storageState: path.join(AUTH, "admin.json") });

  test("profile photo input is named; placeholder tiles meet AA contrast", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "colours are the same on every screen size");
    await page.goto("/settings");
    await expect(page.locator("input[type=file]").first()).toHaveAttribute(
      "aria-label",
      "Choose a profile photo (JPEG, PNG or WebP)",
    );
    // A brand without a logo shows its name; a service without an image shows its icon label.
    await db("INSERT INTO brands (name, slug) VALUES ('QA No Logo Brand', 'qa-no-logo-brand') ON CONFLICT DO NOTHING");
    await page.goto("/brands");
    const brandName = "span.font-display.text-xl";
    await expect(page.locator(brandName, { hasText: "QA No Logo Brand" })).toBeVisible();
    expect(await contrastOf(page, `${brandName}:text("QA No Logo Brand")`)).toBeGreaterThanOrEqual(4.5);
    await page.goto("/services");
    const tile = "td.rtable-media span.rounded-lg"; // the "no image" icon-label tile
    await expect(page.locator(tile).first()).toBeVisible();
    expect(await contrastOf(page, tile)).toBeGreaterThanOrEqual(4.5);
  });
});

test.describe("Owner verification code input", () => {
  test("typing, pasting, upper case, hyphens, 16-character limit, backspace", async ({ page }) => {
    // The isolated database already has administrators (registration closed): show the form via a
    // stubbed status so only the input behaviour is tested; nothing is submitted.
    await page.route("**/api/setup-owner", (r) =>
      r.request().method() === "GET"
        ? r.fulfill({ status: 200, contentType: "application/json", body: '{"open":true}' })
        : r.abort(),
    );
    await page.goto("/setup-owner");
    const code = page.getByLabel("Verification Code");
    await code.pressSequentially("abcd");
    await expect(code).toHaveValue("ABCD");
    await code.pressSequentially("e");
    await expect(code).toHaveValue("ABCD-E");
    await code.pressSequentially("fghjkmnpqrstvwx");
    await expect(code).toHaveValue("ABCD-EFGH-JKMN-PQRS"); // the extra characters are not accepted
    await code.press("Backspace");
    await expect(code).toHaveValue("ABCD-EFGH-JKMN-PQR");
    await code.press("Backspace");
    await code.press("Backspace");
    await code.press("Backspace");
    await expect(code).toHaveValue("ABCD-EFGH-JKMN");
    // Paste with spaces / other separators.
    await code.fill("");
    await code.evaluate((el: HTMLInputElement) => {
      const dt = new DataTransfer();
      dt.setData("text/plain", " zz9q 7k3m-x1v2_r8tw ");
      el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await code.fill(" zz9q 7k3m-x1v2_r8tw "); // what the browser inserts on paste
    await expect(code).toHaveValue("ZZ9Q-7K3M-X1V2-R8TW");
    // Editing in the middle keeps the caret there (not thrown to the end).
    await code.evaluate((el: HTMLInputElement) => el.setSelectionRange(2, 2));
    await code.press("Backspace");
    await expect(code).toHaveValue("Z9Q7-K3MX-1V2R-8TW");
    expect(await code.evaluate((el: HTMLInputElement) => el.selectionStart)).toBe(1);
    // Incomplete code: the same rule as the API (16 letters/digits).
    await code.blur();
    await expect(page.getByText("Enter the 16-character code (XXXX-XXXX-XXXX-XXXX).")).toBeVisible();
  });
});

test.describe("Sign-in rejection (UI)", () => {
  test("an unregistered but valid-looking email gets the same generic message as a wrong password", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "desktop", "sign-in rate limits: run once");
    await signIn(page, "qa.editor@example.invalid", "Some-Password-123");
    const alert = page.locator("main [role=alert]");
    await expect(alert).toHaveText("Incorrect email or password, or the account is temporarily locked.");
    const unknownMessage = await alert.textContent();
    await signIn(page, STAFF.editor.email, "Wrong-Password-123");
    await expect(alert).toHaveText(unknownMessage!);
    await expect(page).toHaveURL(/\/login/);
    // A tampered session cookie is not a session.
    await page.context().addCookies([
      {
        name: "ph_admin_session",
        value: "tampered.token.value",
        domain: "127.0.0.1",
        path: "/",
        httpOnly: true,
        sameSite: "Strict",
      },
    ]);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
