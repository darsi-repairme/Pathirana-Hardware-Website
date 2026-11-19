/**
 * Services shown on /services and /services/<id>/, previewed on the home page
 * and listed in the footer.
 *
 * Source: the client's latest confirmation approves ALL SIX services below
 * (superseding the unchecked boxes in the earlier requirements questionnaire).
 *
 * Details such as delivery areas or charges, minimum bulk quantities,
 * wholesale prices, reservation periods and contractor terms have NOT been
 * supplied, so the copy never states them — visitors are asked to enquire.
 * `enquireAbout` lists questions customers can ask, not promises.
 */
export type ServiceIcon = "bricks" | "truck" | "boxes" | "bookmark" | "lightbulb" | "hardhat";
/** 3D object shown for the service. */
export type ServiceKind = "materials" | "delivery" | "bulk" | "reservations" | "guidance" | "contractor";

export type Service = {
  /** URL slug: /services/<id>/ */
  id: string;
  title: string;
  /** Concise label for the footer. */
  shortTitle: string;
  icon: ServiceIcon;
  kind: ServiceKind;
  /** One short line for the home page. */
  summary: string;
  /** Slightly fuller description for the Services pages. */
  description: string;
  /** What visitors should do to ask about this service. */
  howToAsk: string;
  /** What customers can enquire about (questions to ask the store). */
  enquireAbout: readonly string[];
  /** Information to share in the first message. */
  share: string;
};

export const services: readonly Service[] = [
  {
    id: "building-material-supply",
    title: "Building Material Supply",
    shortTitle: "Building Material Supply",
    icon: "bricks",
    kind: "materials",
    summary: "Cement, steel, plywood, doors, windows and sanitary products.",
    description:
      "Hardware and construction material supply, including cement, steel products such as TOR bars and box bars, plywood, doors, windows and sanitary products.",
    howToAsk: "Tell us the items, sizes and quantities you need, and we will confirm availability.",
    enquireAbout: [
      "Whether the materials you need are available",
      "Current prices for the items on your list",
      "Suitable alternatives if an item is not available",
      "Collecting your materials from the store",
    ],
    share: "the items, sizes and quantities you need",
  },
  {
    id: "home-site-delivery",
    title: "Home / Site Delivery",
    shortTitle: "Home / Site Delivery",
    icon: "truck",
    kind: "delivery",
    summary: "Ask about arranging delivery to your home or site.",
    description: "Customers can enquire about arranging material deliveries to their homes or construction sites.",
    howToAsk:
      "Share your order and location — the store will confirm whether delivery can be arranged and any charges.",
    enquireAbout: [
      "Whether delivery can be arranged to your location",
      "Any delivery charges for your order",
      "When a delivery could be scheduled",
      "Access details for your home or site",
    ],
    share: "your order and the delivery location",
  },
  {
    id: "bulk-orders",
    title: "Bulk Orders",
    shortTitle: "Bulk Orders",
    icon: "boxes",
    kind: "bulk",
    summary: "Enquire about larger-quantity material orders.",
    description: "Customers can enquire about larger-quantity hardware and building material orders.",
    howToAsk: "Send the list of items and quantities you need; the store will confirm availability and details.",
    enquireAbout: [
      "Availability for larger quantities",
      "Pricing for your full material list",
      "Supplying an order in stages",
      "Delivery for larger orders",
    ],
    share: "your list of items and quantities",
  },
  {
    id: "product-reservations",
    title: "Product Reservations",
    shortTitle: "Product Reservations",
    icon: "bookmark",
    kind: "reservations",
    summary: "Contact us about reserving the materials you need.",
    description: "Customers can contact the shop to enquire about reserving the materials they need.",
    howToAsk: "Call or WhatsApp the store to ask whether the items can be reserved and for how long.",
    enquireAbout: [
      "Whether an item can be reserved",
      "How long a reservation can be held",
      "Any payment needed to reserve",
      "Collecting or delivering reserved items",
    ],
    share: "the items you would like to reserve and when you need them",
  },
  {
    id: "product-advice",
    title: "Product Advice & Guidance",
    shortTitle: "Product Advice",
    icon: "lightbulb",
    kind: "guidance",
    summary: "Get guidance when choosing hardware and materials.",
    description: "Customers can request guidance when selecting hardware and building materials.",
    howToAsk: "Describe your job or project and we will help you choose suitable products.",
    enquireAbout: [
      "Which materials suit your job",
      "Comparing the options available at the store",
      "The quantities you may need",
      "Related items for your project",
    ],
    share: "a short description of your job or project",
  },
  {
    id: "contractor-support",
    title: "Contractor & Project Support",
    shortTitle: "Contractor Support",
    icon: "hardhat",
    kind: "contractor",
    summary: "Material enquiries for building projects.",
    description:
      "Contractors and construction customers can enquire about material requirements for their building projects.",
    howToAsk: "Share your project's material list or requirements and the store will get back to you.",
    enquireAbout: [
      "Availability for your project's material list",
      "Pricing for project quantities",
      "Supplying materials as your project progresses",
      "Delivery to your construction site",
    ],
    share: "your project's material list or requirements",
  },
];

export const getService = (id: string) => services.find((s) => s.id === id);
