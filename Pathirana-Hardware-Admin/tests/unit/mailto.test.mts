// Unit tests for the quotation "Email" reply link (security finding: mailto parameter injection).
// Run: node --test tests/unit/  (Node 22.18+ runs TypeScript directly; no extra dependencies.)
import assert from "node:assert/strict";
import { test } from "node:test";
import { mailtoHref, safeEmailAddress } from "../../src/lib/mailto.ts";

const subject = { subject: "Quotation PHQ-261124-ABCDE" };
/** Recipients and headers a mail client would read from the link. */
function parse(href: string) {
  const u = new URL(href);
  return {
    to: decodeURIComponent(u.pathname),
    params: [...u.searchParams.keys()],
    subject: u.searchParams.get("subject"),
  };
}

test("normal addresses work and keep the subject", () => {
  const href = mailtoHref("kamal@example.lk", subject)!;
  assert.equal(href, "mailto:kamal@example.lk?subject=Quotation%20PHQ-261124-ABCDE");
  assert.deepEqual(parse(href), { to: "kamal@example.lk", params: ["subject"], subject: "Quotation PHQ-261124-ABCDE" });
});

test("legitimate special characters stay part of the one address", () => {
  for (const email of ["john.smith+quotes@mail.example.com", "o'brien@example.lk", "a_b-c@sub.example.co.uk"]) {
    const p = parse(mailtoHref(email, subject)!);
    assert.equal(p.to, email);
    assert.deepEqual(p.params, ["subject"]);
  }
});

test("query delimiters in the address cannot add cc/bcc/body headers", () => {
  // Valid per RFC 5322 local-part rules, dangerous if placed in a URL unencoded.
  for (const email of [
    "victim?cc=attacker@evil.example",
    "x&bcc=spy@evil.example",
    "a=b&body=Pay-now@evil.example",
    "a#frag@example.lk",
    "a%3Fcc%3Dspy@example.lk",
  ]) {
    const href = mailtoHref(email, subject)!;
    assert.ok(href, email);
    const p = parse(href);
    assert.equal(p.to, email, "the whole value stays one recipient");
    assert.deepEqual(p.params, ["subject"], `no extra headers for ${email}`);
    assert.equal(p.subject, subject.subject);
  }
});

test("CRLF, control characters, spaces and multiple recipients are refused", () => {
  for (const bad of [
    "a@example.lk\r\nBcc: spy@evil.example",
    "a@example.lk\nbody",
    "a\u0000@example.lk",
    "a b@example.lk",
    "a@example.lk,spy@evil.example",
    "a@example.lk;spy@evil.example",
    "<a@example.lk>",
    '"quoted"@example.lk',
    "a@b@example.lk",
    "@example.lk",
    "a@",
    "a@localhost",
    "a..b@example.lk",
    ".a@example.lk",
    "a@-example.lk",
    "a@example.lk?cc=spy@evil.example",
  ]) {
    assert.equal(mailtoHref(bad, subject), null, JSON.stringify(bad));
  }
});

test("missing or invalid historical values give no link (and never throw)", () => {
  for (const v of [null, undefined, "", "   ", "not-an-email", "x".repeat(300) + "@example.lk"]) {
    assert.equal(mailtoHref(v as string | null | undefined, subject), null);
  }
  assert.equal(safeEmailAddress("  kamal@example.lk  "), "kamal@example.lk");
});

test("only the intended parameters are added, all encoded", () => {
  const href = mailtoHref("kamal@example.lk", { subject: "A&B=C?\r\nBcc: x@y.z", body: "" })!;
  const p = parse(href);
  assert.deepEqual(p.params, ["subject"]);
  assert.equal(p.subject, "A&B=C?\r\nBcc: x@y.z");
  assert.ok(!/[\r\n]/.test(href));
});
