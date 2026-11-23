import { test } from "node:test";
import assert from "node:assert/strict";
import { MESSAGES, MESSAGE_GROUPS } from "../../src/i18n/messages/index.ts";
import { hasTranslation, translate } from "../../src/i18n/translate.ts";
import { isLocale, LOCALE_BOOT_SCRIPT } from "../../src/i18n/config.ts";
import { localized } from "../../src/i18n/localized.ts";
import { productEnquiryText } from "../../src/lib/product-enquiry.ts";

const TAMIL = /[஀-௿]/;
const SINHALA = /[඀-෿]/;
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
/** Proper names, brand names and words that are the same in every language. */
const SAME_IN_ALL = new Set(["Pathirana Hardware", "WhatsApp"]);

test("every entry has a Tamil and a Sinhala version in the right script", () => {
  for (const [en, [ta, si]] of Object.entries(MESSAGES)) {
    assert.ok(ta?.trim(), `missing Tamil: ${en}`);
    assert.ok(si?.trim(), `missing Sinhala: ${en}`);
    if (SAME_IN_ALL.has(en)) continue;
    assert.ok(TAMIL.test(ta), `Tamil text has no Tamil letters: ${en}`);
    assert.ok(SINHALA.test(si), `Sinhala text has no Sinhala letters: ${en}`);
  }
});

test("placeholders are identical in all three languages", () => {
  for (const [en, [ta, si]] of Object.entries(MESSAGES)) {
    assert.deepEqual(placeholders(ta), placeholders(en), `Tamil placeholders differ: ${en}`);
    assert.deepEqual(placeholders(si), placeholders(en), `Sinhala placeholders differ: ${en}`);
  }
});

test("groups never give the same English text two different translations", () => {
  const seen = new Map<string, readonly [string, string]>();
  for (const [group, messages] of Object.entries(MESSAGE_GROUPS)) {
    for (const [en, value] of Object.entries(messages)) {
      const prev = seen.get(en);
      if (prev) assert.deepEqual(value, prev, `"${en}" is translated differently in ${group}`);
      seen.set(en, value);
    }
  }
});

test("translate(): English as written, fallback to English, never a key", () => {
  assert.equal(translate("en", "Products"), "Products");
  assert.equal(translate("ta", "Products"), "பொருட்கள்");
  assert.equal(translate("si", "Products"), "නිෂ්පාදන");
  assert.equal(translate("ta", "A sentence nobody translated"), "A sentence nobody translated");
  assert.equal(translate("si", "Call {phone}", { phone: "071 225 9699" }), "071 225 9699 අමතන්න");
  // Whitespace differences in JSX text still find the entry.
  assert.equal(translate("ta", "  Our   Products "), "எமது பொருட்கள்");
  assert.ok(hasTranslation("Contact for Price"));
});

test("required quotation confirmation is exact in English and translated in ta / si", () => {
  const en =
    "Thank you. Pathirana Hardware has received your quotation request. Our team will contact you to confirm prices, availability and delivery.";
  assert.equal(translate("en", en), en);
  assert.ok(TAMIL.test(translate("ta", en)));
  assert.ok(SINHALA.test(translate("si", en)));
  assert.ok(
    hasTranslation("Submitting a quotation request does not confirm an order or reserve stock. No payment is taken."),
  );
});

test("dynamic content: staff translation, else the real English value", () => {
  const tr = { ta: { name: "சோதனை" }, si: { name: "  " } };
  assert.equal(localized("en", "Test", tr, "name"), "Test");
  assert.equal(localized("ta", "Test", tr, "name"), "சோதனை");
  assert.equal(localized("si", "Test", tr, "name"), "Test"); // blank → English
  assert.equal(localized("ta", "Test", undefined, "name"), "Test");
  assert.equal(localized("ta", null, tr, "summary"), null);
});

test("locale config", () => {
  assert.ok(isLocale("ta") && isLocale("si") && isLocale("en"));
  assert.ok(!isLocale("fr") && !isLocale(null));
  assert.match(LOCALE_BOOT_SCRIPT, /ph-lang/);
});

test("WhatsApp enquiry: Tamil and Sinhala keep price, editable fields and link; Unicode survives encoding", () => {
  const p = {
    name: "சோதனை சீமெந்து",
    price: { contactForPrice: false, final: "2500.00" },
    unit: "bag",
    path: "/products/item/?slug=test",
  };
  const ta = productEnquiryText({ ...p, locale: "ta" }, "https://example.lk");
  assert.match(ta, /^வணக்கம் Pathirana Hardware,/);
  assert.match(ta, /LKR 2,500\.00 \/ bag/);
  assert.match(ta, /\[அளவை உள்ளிடவும்\]/);
  assert.match(ta, /https:\/\/example\.lk\/products\/item\/\?slug=test$/m);
  const si = productEnquiryText({ ...p, name: "පරීක්ෂණ", price: null, locale: "si" }, "https://example.lk");
  assert.match(si, /මිල සඳහා අමතන්න\./);
  assert.doesNotMatch(si, /LKR/);
  assert.equal(decodeURIComponent(encodeURIComponent(si)), si);
  // English stays exactly as approved.
  const en = productEnquiryText({ ...p, name: "Test Cement" }, "https://example.lk");
  assert.match(
    en,
    /^Hello Pathirana Hardware,\n\nI am interested in Test Cement\.\nPrice shown: LKR 2,500\.00 \/ bag\./,
  );
  assert.match(en, /Please confirm availability and delivery charges\.$/);
});
