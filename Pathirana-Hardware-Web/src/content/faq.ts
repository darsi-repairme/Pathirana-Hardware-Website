import { business } from "./business.ts";

/**
 * Frequently asked questions (/faq/ and the Contact page preview).
 * Answers use only confirmed details. Where terms have not been supplied
 * (delivery areas, charges, reservation periods, bulk pricing…), visitors are
 * asked to confirm with the store. The WhatsApp AI ordering assistant is a
 * future plan and is NOT described as available.
 */
export type FaqItem = { id: string; question: string; answer: string };
export type FaqGroup = { id: string; title: string; items: readonly FaqItem[] };

const phone = business.phone.display;

export const faqGroups: readonly FaqGroup[] = [
  {
    id: "general",
    title: "General",
    items: [
      {
        id: "what-products",
        question: "What products does Pathirana Hardware supply?",
        answer:
          "Pathirana Hardware supplies hardware and building materials, including cement, TOR bars, box bars, plywood, doors, windows, bathroom sets, gas cylinders and branded hardware products from brands such as PE+, Swisstek, El Toro and Würth.",
      },
      {
        id: "how-to-contact",
        question: "How can customers contact the shop?",
        answer: `Call or WhatsApp ${phone}, email ${business.email}, or visit the store on ${business.address.street}, ${business.address.locality}.`,
      },
    ],
  },
  {
    id: "products",
    title: "Products",
    items: [
      {
        id: "prices",
        question: "How can I enquire about prices?",
        answer: `Prices are not listed on the website because they change. Call or WhatsApp ${phone} with the item and quantity you need, and the store will share the current price.`,
      },
      {
        id: "availability",
        question: "How can I check product availability?",
        answer: `Stock levels are not shown online. Please call or WhatsApp ${phone} before you visit to check whether the item you need is available.`,
      },
      {
        id: "categories",
        question: "What product categories are available?",
        answer:
          "Building Materials, Steel Products, Plywood, Doors & Windows, Bathroom & Sanitary Products, Gas Cylinders and Branded Hardware Products. You can browse them on the Products page.",
      },
    ],
  },
  {
    id: "services",
    title: "Services",
    items: [
      {
        id: "delivery",
        question: "Do you offer home/site delivery?",
        answer:
          "Customers can enquire about delivery to their home or construction site. Share your order and location, and the store will confirm whether delivery can be arranged, any charges and the timing.",
      },
      {
        id: "bulk",
        question: "Can customers enquire about bulk orders?",
        answer:
          "Yes. Send your list of items and quantities, and the store will confirm availability, pricing and other details for your order.",
      },
      {
        id: "reservations",
        question: "Can products be reserved?",
        answer:
          "Customers can contact the shop to ask about reserving the materials they need. The store will confirm whether an item can be reserved and for how long.",
      },
      {
        id: "guidance",
        question: "Is product guidance available?",
        answer:
          "Yes. Describe your job or project and the store can help you choose suitable hardware and building materials.",
      },
      {
        id: "contractors",
        question: "Can contractors request material support?",
        answer:
          "Contractors and construction customers can enquire about the material requirements for their projects. Share your material list or requirements and the store will get back to you.",
      },
    ],
  },
  {
    id: "ordering",
    title: "Ordering",
    items: [
      {
        id: "whatsapp",
        question: "How do WhatsApp enquiries work?",
        answer: `Tap a WhatsApp button on the website or message ${phone}. A chat opens with a short message about the product or service you selected — add the details you need and send it. Your message is answered by the store; there is no automated ordering system at present.`,
      },
      {
        id: "pay-online",
        question: "Can customers pay directly on the website?",
        answer:
          "No. This website is for information and enquiries only — there is no online shopping cart, checkout or payment. Please contact the store to confirm your order and payment.",
      },
    ],
  },
];

/** The selection shown on the Contact page (service questions + how to reach the store). */
export const faqPreviewIds = ["delivery", "bulk", "reservations", "guidance", "how-to-contact"] as const;

export const allFaqItems = faqGroups.flatMap((g) => g.items);
