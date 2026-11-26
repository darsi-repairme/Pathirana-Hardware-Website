import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addressOneLine,
  business,
  mailHref,
  mapsHref,
  mapsIsVerifiedPin,
  telHref,
  whatsappChatHref,
  whatsappEnquiryHref,
  whatsappHref,
} from "../../src/content/business.ts";
import { absoluteUrl, getSiteUrl } from "../../src/lib/site-url.ts";
import { buildLocalBusinessJsonLd, serializeJsonLd } from "../../src/lib/structured-data.ts";

test("verified contact details are exact", () => {
  assert.equal(business.legalName, "Pathirana Hardware (Pvt) Ltd.");
  assert.equal(business.tagline, "Shop smarter, save bigger!");
  assert.equal(business.phone.display, "071 225 9699");
  assert.equal(business.phone.international, "+94 71 225 9699");
  assert.equal(telHref, "tel:+94712259699");
  assert.equal(mailHref, "mailto:pathiranahardwarepvt@gmail.com");
  assert.equal(business.social.facebook, "https://www.facebook.com/p/Pathirana-Hardware-100054510037278/");
  assert.equal(addressOneLine, "Pathirana Hardware, Pallama Road, Bangadeniya, Sri Lanka");
});

test("phone formats agree with each other", () => {
  const local = business.phone.display.replace(/\D/g, "");
  const e164 = business.phone.e164.replace(/\D/g, "");
  assert.equal(`94${local.slice(1)}`, e164);
  assert.equal(business.phone.international.replace(/\D/g, ""), e164);
});

test("unconfirmed details stay unpublished by default", () => {
  assert.equal(business.geo, null);
});

test("client-confirmed opening hours (no invented holiday schedule)", () => {
  assert.deepEqual(business.openingHours, [
    { days: "Monday – Saturday", hours: "7:30 AM – 7:00 PM" },
    { days: "Sunday", hours: "Closed" },
  ]);
});

test("client-confirmed establishment date and owner", () => {
  assert.equal(business.foundedYear, 1997);
  assert.equal(business.foundedDate, "16 April 1997");
  assert.equal(business.owner, "Oshada Warshan Pathirana");
});

test("WhatsApp uses the confirmed phone number; enquiries are URL-encoded", () => {
  assert.equal(business.whatsappE164, "+94712259699");
  assert.equal(whatsappHref, "https://wa.me/94712259699");
  assert.equal(whatsappChatHref, "https://wa.me/94712259699");
  const href = whatsappEnquiryHref("Doors & Windows");
  const url = new URL(href);
  assert.equal(url.origin + url.pathname, "https://wa.me/94712259699");
  assert.equal(
    url.searchParams.get("text"),
    "Hello Pathirana Hardware, I would like to enquire about Doors & Windows.",
  );
  assert.match(href, /%20Doors%20%26%20Windows\.$/);
});

test("client-supplied social links are exact", () => {
  assert.equal(business.social.instagram, "https://www.instagram.com/pathiranahardware?exln=MWw0OWdpdTV2djI4eA==");
  assert.equal(business.social.linkedin, "https://www.linkedin.com/in/pathirana-hardwere-pvt-ltd-a6826943a");
  assert.equal(business.social.tiktok.url, "https://www.tiktok.com/@pathiranahardwar?_r=1&_t=ZS-9BLldMwKUGl");
});

test("maps link is an address search until a pin is verified", () => {
  assert.equal(mapsIsVerifiedPin, false);
  const url = new URL(mapsHref);
  assert.equal(url.origin, "https://www.google.com");
  assert.equal(url.searchParams.get("query"), addressOneLine);
});

test("site URL handling never invents a domain", () => {
  assert.equal(getSiteUrl(undefined), null);
  assert.equal(getSiteUrl(""), null);
  assert.equal(getSiteUrl("not a url"), null);
  assert.equal(getSiteUrl("javascript:alert(1)"), null);
  assert.equal(absoluteUrl("/about/", null), null);
  const site = getSiteUrl("https://www.example.lk/");
  assert.equal(absoluteUrl("/about/", site), "https://www.example.lk/about/");
});

test("structured data contains only verified fields", () => {
  const data = buildLocalBusinessJsonLd(null);
  assert.equal(data["@type"], "HardwareStore");
  assert.equal(data.telephone, "+94712259699");
  for (const key of ["url", "geo", "openingHours", "aggregateRating", "review"]) {
    assert.equal(key in data, false, `${key} must be absent`);
  }
  assert.equal(data.foundingDate, "1997");
  const withSite = buildLocalBusinessJsonLd(getSiteUrl("https://www.example.lk"));
  assert.equal(withSite.url, "https://www.example.lk/");
});

test("JSON-LD serialisation cannot break out of the script tag", () => {
  const out = serializeJsonLd({ x: "</script><script>alert(1)</script>" });
  assert.equal(out.includes("<"), false);
  assert.deepEqual(JSON.parse(out), { x: "</script><script>alert(1)</script>" });
});
