import { test } from "node:test";
import assert from "node:assert/strict";
import { quotationWhatsappText, whatsappTextHref, type QuotationForm } from "../../src/lib/quotation.ts";

const form = (over: Partial<QuotationForm> = {}): QuotationForm => ({
  customerName: "Test Customer",
  phone: "0712345678",
  location: "Chilaw",
  otherLocation: "",
  fulfilment: "collection",
  deliveryAddress: "",
  email: "test@example.com",
  notes: "",
  contactConsent: true,
  items: [{ productName: "Test Cement", quantity: "10", unit: "bag" }],
  ...over,
});

test("WhatsApp message follows the approved layout with the saved reference", () => {
  const text = quotationWhatsappText("PHQ-261120-ABCD", form(), 0);
  assert.equal(
    text,
    [
      "Hello Pathirana Hardware,",
      "",
      "I would like to request a quotation.",
      "",
      "Quotation Reference: PHQ-261120-ABCD",
      "",
      "Customer Name: Test Customer",
      "Contact Number: 0712345678",
      "",
      "Requested Items:",
      "1. Test Cement — Quantity: 10 bag",
      "",
      "Delivery/Pickup: Pickup from the store",
      "Location: Chilaw",
      "",
      "Please review my request and confirm prices, stock availability and delivery arrangements.",
      "",
      "Thank you.",
    ].join("\n"),
  );
  // Optional fields that were not supplied are left out; the email is never added.
  assert.doesNotMatch(text, /Additional Notes|Delivery Address|reference photo|test@example\.com/);
});

test("multiple items, delivery address, notes, typed location and photo count", () => {
  const text = quotationWhatsappText(
    "PHQ-1",
    form({
      fulfilment: "delivery",
      deliveryAddress: "12 Main Street",
      location: "Other",
      otherLocation: "Marawila",
      notes: "Grade 53",
      items: [
        { productName: "Cement", quantity: "5", unit: "" },
        { productName: "TOR bar 12mm", quantity: "2.5", unit: "ton" },
      ],
    }),
    3,
  );
  for (const line of [
    "1. Cement — Quantity: 5",
    "2. TOR bar 12mm — Quantity: 2.5 ton",
    "Delivery/Pickup: Delivery",
    "Location: Marawila",
    "Delivery Address: 12 Main Street",
    "Additional Notes: Grade 53",
    "I attached 3 reference photos to this request on your website.",
  ])
    assert.ok(text.split("\n").includes(line), line);
  assert.doesNotMatch(text, /https?:|LKR|confirmed\b/i); // no photo links, prices or confirmations
});

test("Tamil and Sinhala labels; customer values are never changed", () => {
  const name = "රවී குமார்"; // Sinhala + Tamil script
  for (const locale of ["ta", "si"] as const) {
    const text = quotationWhatsappText("PHQ-2", form({ customerName: name }), 1, locale);
    assert.ok(text.includes("PHQ-2"));
    assert.ok(text.includes(`: ${name}`));
    assert.ok(text.includes("Test Cement"));
    assert.doesNotMatch(text, /\{\w+\}/); // every placeholder filled
    assert.doesNotMatch(text, /Quotation Reference|Requested Items/); // labels translated
  }
});

test("the link opens the shop's chat with the whole message encoded (Send stays with the customer)", () => {
  const text = quotationWhatsappText("PHQ-3", form({ notes: "50% & more #1?" }), 0);
  const href = whatsappTextHref(text);
  assert.ok(href.startsWith("https://wa.me/94712259699?text="));
  assert.equal(new URL(href).searchParams.get("text"), text);
});
