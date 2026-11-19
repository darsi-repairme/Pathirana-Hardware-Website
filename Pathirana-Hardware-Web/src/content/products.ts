/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  PRODUCT CATEGORIES (category level only)
 * ─────────────────────────────────────────────────────────────────────────────
 *  Source: Pathirana_Hardware_Client_Requirements_Filled.docx (2.1, 2.2).
 *  Categories and the documented products/brands come from the client. There
 *  is no verified catalogue yet: no prices, models, sizes, stock or discounts.
 *
 *  `image` points to illustrative category artwork (not photographs of the
 *  shop). A category without a matching image shows an icon card instead.
 *
 *  `searchTerms` are everyday words visitors may type in the search box; they
 *  only point the visitor to the right category and are NOT a claim that a
 *  specific item is in stock.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type ProductCategoryId =
  | "building-materials"
  | "steel-products"
  | "plywood"
  | "doors-windows"
  | "bathroom-sanitary"
  | "gas-cylinders"
  | "branded-hardware";

export type ProductCategory = {
  id: ProductCategoryId;
  title: string;
  /** One short line. */
  summary: string;
  /** Short introduction for the category page (factual, no stock claims). */
  intro: string;
  /** Key into the image map in src/lib/images.ts (omitted → icon card). */
  image?:
    | "aisleMaterials"
    | "heroConstruction"
    | "plywood"
    | "doorsWindows"
    | "plumbing"
    | "gasCylinders"
    | "toolsPaint"
    | "cementBags"
    | "torBars"
    | "toolsHardware"
    | "boxBars"
    | "bathroomSets";
  searchTerms: readonly string[];
};

/**
 * Brands documented by the client (no partnership or stock claims). Spelling
 * follows the brands' own logos supplied by the client (e.g. "Swisstek").
 */
export const documentedBrands = ["PE+", "Swisstek", "El Toro", "Würth"] as const;
export type Brand = (typeof documentedBrands)[number];

/** Original logo files supplied by the client (public/brands/, unmodified). */
export const brandLogos: readonly { brand: Brand; src: string; width: number; height: number }[] = [
  { brand: "PE+", src: "/brands/pe-plus.png", width: 144, height: 91 },
  { brand: "Swisstek", src: "/brands/swisstek.png", width: 360, height: 166 },
  { brand: "El Toro", src: "/brands/el-toro.png", width: 163, height: 152 },
  { brand: "Würth", src: "/brands/wurth.png", width: 128, height: 128 },
];

export const productCategories: readonly ProductCategory[] = [
  {
    id: "building-materials",
    title: "Building Materials",
    summary: "Cement and other materials for building and construction work.",
    intro:
      "Cement and other building materials for homes, renovations and construction work. Tell us what you are building and the quantities you need, and the store will confirm what is available.",
    image: "aisleMaterials",
    searchTerms: ["building", "construction", "cement", "materials"],
  },
  {
    id: "steel-products",
    title: "Steel Products",
    summary: "TOR bars, box bars and other steel for construction.",
    intro:
      "Steel for construction, including TOR bars and box bars. Sizes, lengths and quantities vary — contact the store to check what is available for your job.",
    image: "heroConstruction",
    searchTerms: ["steel", "tor", "tor bars", "box bar", "box bars", "iron", "rebar", "bars"],
  },
  {
    id: "plywood",
    title: "Plywood",
    summary: "Plywood for building and home projects.",
    intro:
      "Plywood for building, furniture and home projects. Ask the store about the types, thicknesses and sheet quantities you need.",
    image: "plywood",
    searchTerms: ["plywood", "ply", "board", "boards", "sheet", "sheets", "wood"],
  },
  {
    id: "doors-windows",
    title: "Doors & Windows",
    summary: "Doors and windows for new builds and renovations.",
    intro:
      "Doors and windows for new builds and renovations. Share your sizes and requirements, and the store will let you know the available options.",
    image: "doorsWindows",
    searchTerms: ["door", "doors", "window", "windows", "frame", "frames"],
  },
  {
    id: "bathroom-sanitary",
    title: "Bathroom & Sanitary",
    summary: "Bathroom sets and sanitary products.",
    intro:
      "Bathroom sets and sanitary products for new homes and bathroom upgrades. Contact the store to ask about the items you are looking for.",
    image: "plumbing",
    searchTerms: ["bathroom", "bathroom set", "sanitary", "toilet", "basin", "shower", "tap", "taps", "plumbing"],
  },
  {
    id: "gas-cylinders",
    title: "Gas Cylinders",
    summary: "Gas cylinders — ask the store about availability.",
    intro:
      "Gas cylinders are available to enquire about at the store. Please call or WhatsApp to check availability before you visit.",
    image: "gasCylinders",
    searchTerms: ["gas", "gas cylinder", "cylinder", "cylinders", "lpg"],
  },
  {
    id: "branded-hardware",
    title: "Branded Hardware",
    summary: "Hardware products, including brands such as PE+, Swisstek, El Toro and Würth.",
    intro:
      "Hardware products, including brands such as PE+, Swisstek, El Toro and Würth. Individual products are not listed online yet — ask the store about the brand and item you need.",
    image: "toolsPaint",
    searchTerms: [
      "hardware",
      "tools",
      "tool",
      "brand",
      "brands",
      "pe+",
      "swisstech",
      "swisstek",
      "eltoro",
      "el toro",
      "wurth",
      "würth",
    ],
  },
];

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  DOCUMENTED PRODUCT TYPES
 * ─────────────────────────────────────────────────────────────────────────────
 *  The product types the client named in the requirements: cement, TOR bars,
 *  plywood, box bars, doors, windows, bathroom sets and gas cylinders.
 *  These are product TYPES, not SKUs: no models, sizes, prices or stock.
 *  Branded Hardware has no individually documented product types yet.
 *
 *  `image` is illustrative artwork (not a photograph of the shop); without a
 *  genuinely matching image a product shows an icon card instead.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export type ProductType = {
  /** URL slug: /products/<slug>/ */
  slug: string;
  name: string;
  /** How the product is written inside an enquiry sentence. */
  enquiryName: string;
  category: ProductCategoryId;
  /** One short line for cards. */
  summary: string;
  /** Short factual description for the product page. */
  description: string;
  /** What visitors can ask the store about (questions, not promises). */
  askAbout: readonly string[];
  image?: ProductCategory["image"];
  /**
   * Brands this product type is documented under. Left empty until the client
   * confirms which brands apply — never inferred.
   */
  brands?: readonly Brand[];
  /** object-position utility for the image crop. */
  crop?: string;
  searchTerms: readonly string[];
};

export const productTypes: readonly ProductType[] = [
  {
    slug: "cement",
    name: "Cement",
    enquiryName: "cement",
    category: "building-materials",
    summary: "Cement for building and construction work.",
    description:
      "Cement for building, masonry and general construction work. Contact the store to ask about the cement available and the quantity you need.",
    askAbout: ["Available cement types", "Current prices", "The quantity you need", "Delivery to your home or site"],
    image: "cementBags",
    crop: "object-[60%_50%]",
    searchTerms: ["cement", "concrete", "masonry", "building"],
  },
  {
    slug: "tor-bars",
    name: "TOR Bars",
    enquiryName: "TOR bars",
    category: "steel-products",
    summary: "TOR steel bars for reinforced construction.",
    description:
      "TOR bars (steel reinforcement bars) for construction. Contact the store to ask about the sizes, lengths and quantities available.",
    askAbout: ["Available sizes and lengths", "Current prices", "The quantity you need", "Delivery to your site"],
    image: "torBars",
    crop: "object-[35%_55%]",
    searchTerms: ["tor", "tor bar", "tor bars", "steel", "rebar", "reinforcing", "iron", "bars"],
  },
  {
    slug: "plywood",
    name: "Plywood",
    enquiryName: "plywood",
    category: "plywood",
    summary: "Plywood sheets for building and home projects.",
    description:
      "Plywood for building, furniture and home projects. Contact the store to ask about the types, thicknesses and sheet quantities available.",
    askAbout: ["Available types and thicknesses", "Current prices", "The number of sheets you need", "Delivery"],
    image: "plywood",
    crop: "object-[45%_60%]",
    searchTerms: ["plywood", "ply", "board", "boards", "sheet", "sheets", "wood"],
  },
  {
    slug: "box-bars",
    name: "Box Bars",
    enquiryName: "box bars",
    category: "steel-products",
    summary: "Box bars for construction and fabrication work.",
    description:
      "Box bars (hollow steel sections) for construction and fabrication work. Contact the store to ask about the sizes and quantities available.",
    askAbout: ["Available sizes", "Current prices", "The quantity you need", "Delivery to your site"],
    image: "boxBars",
    crop: "object-[80%_80%]",
    searchTerms: ["box bar", "box bars", "steel", "hollow section", "iron"],
  },
  {
    slug: "doors",
    name: "Doors",
    enquiryName: "doors",
    category: "doors-windows",
    summary: "Doors for new builds and renovations.",
    description:
      "Doors for new homes and renovations. Share the sizes and style you need, and the store will let you know the available options.",
    askAbout: ["Available styles and materials", "Sizes", "Current prices", "Delivery"],
    image: "doorsWindows",
    crop: "object-[14%_55%]",
    searchTerms: ["door", "doors", "frame", "frames"],
  },
  {
    slug: "windows",
    name: "Windows",
    enquiryName: "windows",
    category: "doors-windows",
    summary: "Windows for new builds and renovations.",
    description:
      "Windows for new homes and renovations. Share your window sizes and requirements, and the store will let you know the available options.",
    askAbout: ["Available styles and materials", "Sizes", "Current prices", "Delivery"],
    image: "doorsWindows",
    crop: "object-[76%_50%]",
    searchTerms: ["window", "windows", "frame", "frames", "glass"],
  },
  {
    slug: "bathroom-sets",
    name: "Bathroom Sets",
    enquiryName: "bathroom sets",
    category: "bathroom-sanitary",
    summary: "Bathroom sets for new homes and upgrades.",
    description:
      "Bathroom sets for new homes and bathroom upgrades. Contact the store to ask about the sets and sanitary products available.",
    askAbout: ["Available bathroom sets", "Current prices", "Matching sanitary products", "Delivery"],
    image: "bathroomSets",
    crop: "object-[45%_45%]",
    searchTerms: ["bathroom", "bathroom set", "bathroom sets", "sanitary", "toilet", "basin", "shower", "tap", "taps"],
  },
  {
    slug: "gas-cylinders",
    name: "Gas Cylinders",
    enquiryName: "gas cylinders",
    category: "gas-cylinders",
    summary: "Gas cylinders — ask the store about availability.",
    description:
      "Gas cylinders for home and business use. Please call or WhatsApp the store to check availability before you visit.",
    askAbout: ["Availability", "Available cylinder sizes", "Current prices", "The best time to visit"],
    image: "gasCylinders",
    crop: "object-[55%_55%]",
    searchTerms: ["gas", "gas cylinder", "gas cylinders", "cylinder", "cylinders", "lpg"],
  },
];

export const getCategory = (id: string) => productCategories.find((c) => c.id === id);
export const getProductType = (slug: string) => productTypes.find((p) => p.slug === slug);
export const productTypesIn = (id: ProductCategoryId) => productTypes.filter((p) => p.category === id);

/** Verified, individually listed products. Empty until the business supplies a catalogue. */
export type CatalogueProduct = {
  id: string;
  name: string;
  category: ProductCategoryId;
};
export const catalogue: readonly CatalogueProduct[] = [];
