import meta from "./image-meta.json";

/** Main site images. Dimensions come from `npm run assets` (src/lib/image-meta.json). */
function img(src: keyof typeof meta, alt: string) {
  return { src, alt, ...meta[src] };
}

export const images = {
  logo: img("/images/pathirana-logo-transparent.png", "Pathirana Hardware (Pvt) Ltd. logo"),
  logoLight: img("/images/pathirana-logo-transparent-light.png", "Pathirana Hardware (Pvt) Ltd. logo"),
  hero: img(
    "/images/pathirana-hero-helmet-banner.png",
    "Yellow safety helmet with the Pathirana Hardware mark, resting on bricks beside a trowel, tape measure, spirit level, hammer and work gloves",
  ),
  shop: img(
    "/images/pathirana-shop-about.png",
    "Pathirana Hardware storefront with its red signboard, glass entrance and building materials displayed outside",
  ),
  /** Stand-alone brand mark (transparent, symbol only). Source: assets/images/. */
  logoMark: img("/images/pathirana-logo-mark.png", "Pathirana Hardware logo mark"),
  shopFront: img(
    "/images/pathirana-shop-front.jpg",
    "Pathirana Hardware shop front with its red signboard and a bright glass entrance looking into the store",
  ),
  plumbing: img(
    "/images/pathirana-plumbing.jpg",
    "Grey and white PVC pipes, elbows, brass valves and pipe clamps displayed on a counter",
  ),
  toolsPaint: img(
    "/images/pathirana-tools-paint.png",
    "Paint tins, paint brushes, a roller tray, a cordless drill, a tape measure and bolts on a counter",
  ),
  aisleTools: img(
    "/images/pathirana-aisle-tools.png",
    "Store aisle with hand tools, tool boxes and hoses on the left and paint tins on the right",
  ),
  aisleMaterials: img(
    "/images/pathirana-aisle-materials.png",
    "Store aisle with pipes and fittings on shelves, paint tins, ceiling boards, bricks and concrete blocks",
  ),
  ctaBanner: img(
    "/images/pathirana-cta-banner.png",
    "Bricks, a spirit level, a tape measure, a hammer and a yellow safety helmet on a dark green surface",
  ),
  heroConstruction: img(
    "/images/pathirana-hero-construction.png",
    "A building under construction with scaffolding, a yellow excavator, steel bars and concrete blocks on site",
  ),
  heroMaterials: img(
    "/images/pathirana-hero-materials.png",
    "Hardware store interior with shelves of paint and tools, bricks, cement bags, boards and pipes",
  ),
  /** HD storefront artwork (illustrative — not a photograph of the premises). */
  storefront: img(
    "/images/pathirana_hardware_storefront.png",
    "Illustration of a Pathirana Hardware (Pvt) Ltd. storefront with the red and green logo, a green and white facade and glass shop windows",
  ),
  /** Product category artwork (illustrative — not photographs of the shop). */
  plywood: img(
    "/images/premium_plywood_showroom_display.png",
    "Illustration of strapped stacks of plywood sheets on a pallet beside a display of plywood panels",
  ),
  doorsWindows: img(
    "/images/forest_green_luxury_door_and_window_showroom.png",
    "Illustration of a door and window display with wooden, green and cream doors and framed sliding and casement windows",
  ),
  gasCylinders: img(
    "/images/premium_green_and_gold_gas_cylinder_display.png",
    "Illustration of green and yellow gas cylinders of different sizes on a display counter",
  ),
  /** Products page photography (client-supplied, generated — shown as illustrations). */
  cementBags: img("/images/product-cement-bags.png", "Illustration of stacked cement bags on a wooden pallet"),
  torBars: img("/images/product-tor-bars.png", "Illustration of a strapped bundle of ribbed steel TOR bars"),
  toolsHardware: img(
    "/images/product-tools-hardware.png",
    "Illustration of hand tools and fixings: a hammer, spirit level, tape measure, pliers, spanner, screwdriver and bolts",
  ),
  productsCtaBanner: img(
    "/images/products-cta-banner.png",
    "Cement bags, bricks and steel bars on the left and pipes, paint, a hammer and a tape measure on the right, on dark green",
  ),
  boxBars: img(
    "/images/product-box-bars.png",
    "Illustration of a strapped stack of square hollow steel box bars on a wooden pallet",
  ),
  bathroomSets: img(
    "/images/product-bathroom-sets.png",
    "Illustration of a bathroom display with a wash basin, toilet, shower, taps and bathroom accessories",
  ),
  /** Inner-page heroes and gallery artwork (client-supplied, generated — shown as illustrations). */
  contactHero: img(
    "/images/contact-hero.png",
    "Illustration of a hardware store with shelves of paint, tools, pipe fittings, steel bars and cement bags",
  ),
  storeInterior: img(
    "/images/gallery-store-interior.png",
    "Illustration of a hardware store aisle with hand tools and tool boxes on the left and paint, sealants and pipes on the right",
  ),
  buildingMaterials: img(
    "/images/gallery-building-materials.png",
    "Illustration of bricks, concrete blocks, sand, gravel, steel bars, a safety helmet and builder's tools",
  ),
  toolsTimber: img(
    "/images/gallery-tools-hardware.png",
    "Illustration of power drills, hand tools, screws and bolts on a workbench beside timber and steel sections",
  ),
  /** Static footer artwork: the supplied gold construction panorama with its green made
   *  transparent (scripts/prepare-brand-assets.mjs), so it sits on the header's forest-900. */
  footerArtwork: img(
    "/images/pathirana-footer-artwork.png",
    "Gold construction skyline with scaffolding, a crane, houses and hardware tools on green",
  ),
} as const;
