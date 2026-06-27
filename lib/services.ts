/**
 * Qasr Alshar Salon — full service catalogue (prices in AED).
 * Transcribed from the official salon menu. This is the canonical source
 * consumed by marketing pages and the Prisma seed (prisma/seed.ts).
 */

export type ServiceItem = {
  name: string;
  price: number;
  /** estimated duration in minutes — drives booking slot length */
  duration: number;
  plus?: boolean;
};

export type ServiceCategory = {
  slug: string;
  name: string;
  /** short hook shown on cards */
  tagline: string;
  /** SEO-rich intro for the category landing page */
  intro: string;
  /** keyword list woven into metadata */
  keywords: string[];
  image: string;
  items: ServiceItem[];
};

export const CATEGORIES: ServiceCategory[] = [
  {
    slug: "braiding",
    name: "Braiding & Locs",
    tagline: "Knotless, box braids, cornrows, boho & locs — for Afro hair",
    intro:
      "Qasr Alshar is one of Dubai's true specialists in protective styling for Afro-textured hair. From knotless braids, box braids and cornrows to boho braids, twists, locs and microlocs, our braiders work with a gentle, low-tension hand that protects your edges and scalp. We care for every curl pattern — including 4C — and offer fresh installs, retwists and take-downs. Prices are starting points; for an exact quote on your length and size, send us a photo on WhatsApp.",
    keywords: [
      "braiding Dubai",
      "knotless braids Dubai",
      "box braids Dubai",
      "cornrows Dubai",
      "locs Dubai",
      "sister locks Dubai",
      "Afro hair salon Dubai",
    ],
    image: "/work/hair/braiding-knotless-boho-curly-ends.jpg",
    items: [
      { name: "Cornrow Updo (Line Updo)", price: 200, duration: 240 },
      { name: "Cornrows Down (Downdo)", price: 100, duration: 150 },
      { name: "Feed-in Cornrows (no wash)", price: 50, duration: 120 },
      { name: "Twist Out", price: 120, duration: 120 },
      { name: "Box / Knotless Braids", price: 50, duration: 300, plus: true },
      { name: "Boho / Goddess Braids", price: 200, duration: 360 },
      { name: "Loc Retwist / Retouch", price: 150, duration: 180 },
      { name: "Starter Locs Installation", price: 300, duration: 240, plus: true },
      { name: "Loc Crochet / Reattach", price: 150, duration: 180 },
      { name: "Sister Locks Installation", price: 300, duration: 360, plus: true },
      { name: "Sister Locks Retouch", price: 100, duration: 180 },
      { name: "Two-Strand Twists", price: 200, duration: 240 },
      { name: "Micro Twists", price: 300, duration: 360 },
    ],
  },
  {
    slug: "weaving",
    name: "Weaving & Wigs",
    tagline: "Afro sew-ins, frontal installs, custom wigs & revamps",
    intro:
      "Transform your look with a seamless sew-in or a custom wig from Qasr Alshar. We specialise in natural-looking installs on Afro and curly hair — track and sew, full weaving, closure and frontal wig installation, wig washing, bespoke wig making and revamping. Every install is laid to look completely natural and last beautifully.",
    keywords: [
      "weave Dubai",
      "Afro sew in Dubai",
      "frontal install Dubai",
      "wig installation Dubai",
      "custom wig Dubai",
      "wig making Dubai",
    ],
    image: "/services/weaving.jpg",
    items: [
      { name: "Track and Sew", price: 200, duration: 150 },
      { name: "Weaving", price: 250, duration: 180 },
      { name: "Wig Installation", price: 50, duration: 60 },
      { name: "Wig Wash", price: 50, duration: 45 },
      { name: "Wig Making", price: 300, duration: 240 },
      { name: "Wig Revamping", price: 250, duration: 180 },
    ],
  },
  {
    slug: "hair",
    name: "Hair",
    tagline: "Cuts, colour, keratin, botox & treatments",
    intro:
      "From a sharp cut and glossy blowdry to colour, highlights, keratin rebonding, protein treatments and hair botox — our stylists care for every hair type. Step out with healthy, salon-fresh hair every time.",
    keywords: [
      "hair salon Dubai",
      "haircut Dubai",
      "hair colour Dubai",
      "keratin treatment Dubai",
      "hair botox Dubai",
    ],
    image: "/services/hair.jpg",
    items: [
      { name: "Hair Cut", price: 50, duration: 45 },
      { name: "Wash", price: 30, duration: 30 },
      { name: "Iron", price: 20, duration: 30 },
      { name: "Blowdry", price: 70, duration: 45 },
      { name: "Style & Blow", price: 50, duration: 45 },
      { name: "Treatment", price: 50, duration: 45 },
      { name: "Colour", price: 50, duration: 90 },
      { name: "Undo", price: 50, duration: 45 },
      { name: "Cellophane Colour", price: 150, duration: 120 },
      { name: "Highlight", price: 50, duration: 120 },
      { name: "Hair Spa / Hair Oil", price: 50, duration: 60 },
      { name: "Hair Cellophane", price: 50, duration: 90 },
      { name: "Curly Permanent", price: 100, duration: 150 },
      { name: "Digital Curly", price: 200, duration: 180 },
      { name: "Keratin Rebonding", price: 100, duration: 180 },
      { name: "Protein Treatment", price: 200, duration: 150 },
      { name: "Hair Botox", price: 150, duration: 150 },
    ],
  },
  {
    slug: "nails",
    name: "Nails",
    tagline: "Manicure, pedicure, gelish, polygel & extensions",
    intro:
      "Treat your hands and feet at Qasr Alshar. Choose from regular and gelish manicures, pedicures, nail extensions, polygel, overlays and refills — beautifully finished in a relaxing setting.",
    keywords: [
      "nail salon Dubai",
      "manicure Dubai",
      "pedicure Dubai",
      "gel nails Dubai",
      "nail extensions Dubai",
    ],
    image: "/work/nails/nail-art-gold-chrome-french-tips.jpg",
    items: [
      { name: "Regular Manicure", price: 30, duration: 45 },
      { name: "Manicure Gelish", price: 70, duration: 60 },
      { name: "Pedicure", price: 50, duration: 60 },
      { name: "Nail Extension", price: 150, duration: 90 },
      { name: "Polygel", price: 150, duration: 90 },
      { name: "Refill", price: 100, duration: 75 },
      { name: "Overlay", price: 100, duration: 75 },
    ],
  },
  {
    slug: "facials",
    name: "Facials & Skin",
    tagline: "Classic & hydra facials and gentle brightening",
    intro:
      "Refresh and revive your skin with our classic facial, deeply hydrating hydra facial, and gentle brightening treatments that even out tone and restore a healthy, radiant glow.",
    keywords: [
      "facial Dubai",
      "hydra facial Dubai",
      "skin brightening Dubai",
      "best facial Union Metro",
    ],
    image: "/salon/salon-facial.jpg",
    items: [
      { name: "Classic Facial", price: 100, duration: 60 },
      { name: "Hydra Facial", price: 250, duration: 75 },
      { name: "Face Brightening", price: 100, duration: 45 },
      { name: "Hand Brightening", price: 150, duration: 45 },
      { name: "Feet Brightening", price: 150, duration: 45 },
      { name: "Full Body Brightening", price: 250, duration: 90 },
    ],
  },
  {
    slug: "makeup",
    name: "Makeup & Style",
    tagline: "Soft glam, full glam & bridal artistry",
    intro:
      "From an effortless soft glam to a head-turning full glam and complete bridal makeup, our artists create looks that last all day and photograph beautifully — perfect for weddings, parties and special occasions in Dubai.",
    keywords: [
      "makeup artist Dubai",
      "bridal makeup Dubai",
      "party makeup Dubai",
      "soft glam Dubai",
    ],
    image: "/salon/salon-makeup.jpg",
    items: [
      { name: "Soft Glam", price: 140, duration: 60 },
      { name: "Full Glam", price: 200, duration: 90 },
      { name: "Bridal Makeup", price: 400, duration: 150 },
    ],
  },
  {
    slug: "henna",
    name: "Henna",
    tagline: "Bridal, traditional, floral & festive henna art",
    intro:
      "Henna by Qasr celebrates the timeless art of mehndi. Crafted with care for bridal, traditional, floral, western and festive occasions — drawn with passion to make you feel radiant on your special day.",
    keywords: [
      "henna Dubai",
      "bridal henna Dubai",
      "mehndi artist Dubai",
      "henna design Dubai",
    ],
    image: "/work/henna/henna-floral-arabesque-both-hands.jpg",
    items: [
      { name: "Henna — One Side", price: 100, duration: 45 },
      { name: "Henna — Leg", price: 100, duration: 45 },
    ],
  },
  {
    slug: "lashes",
    name: "Eyelashes",
    tagline: "Classic, volume & one-by-one extensions",
    intro:
      "Open up your eyes with our lash services — curly lashes, classic extensions, one-by-one and three-by-three sets applied by trained lash technicians for a flawless, long-lasting flutter.",
    keywords: [
      "eyelash extensions Dubai",
      "lash lift Dubai",
      "classic lashes Dubai",
      "volume lashes Dubai",
    ],
    image: "/services/lashes.jpg",
    items: [
      { name: "Eye Lashes Curly", price: 50, duration: 45 },
      { name: "Eyelashes Extension", price: 100, duration: 90 },
      { name: "One by One Lashes", price: 150, duration: 120 },
      { name: "Three by Three Lashes", price: 80, duration: 75 },
    ],
  },
  {
    slug: "waxing",
    name: "Waxing",
    tagline: "Smooth, gentle waxing head to toe",
    intro:
      "Enjoy smooth, glowing skin with our gentle waxing services — from upper lip, chin and underarms to full hand, legs, bikini and full body. Quick, hygienic and professional.",
    keywords: [
      "waxing Dubai",
      "full body wax Dubai",
      "bikini wax Dubai",
      "underarm wax Dubai",
    ],
    image: "/services/waxing.jpg",
    items: [
      { name: "Upper Lip", price: 10, duration: 15 },
      { name: "Chin", price: 10, duration: 15 },
      { name: "Under Arm", price: 20, duration: 20 },
      { name: "Full Face", price: 50, duration: 30 },
      { name: "Half Hand", price: 30, duration: 20 },
      { name: "Full Hand", price: 30, duration: 30 },
      { name: "2 Leg", price: 100, duration: 45 },
      { name: "Bikini", price: 100, duration: 30 },
      { name: "Full Body Wax", price: 250, duration: 90 },
    ],
  },
  {
    slug: "threading",
    name: "Threading",
    tagline: "Crisp, precise brow & face threading",
    intro:
      "Define your brows and keep your face fuzz-free with our precise threading — eyebrow, upper lip and full-face, shaped to suit you.",
    keywords: [
      "threading Dubai",
      "eyebrow threading Dubai",
      "brow shaping Dubai",
    ],
    image: "/services/threading.jpg",
    items: [
      { name: "Eyebrow", price: 30, duration: 15 },
      { name: "Upper Lip", price: 20, duration: 10 },
      { name: "Full Face", price: 50, duration: 30 },
    ],
  },
  {
    slug: "massage",
    name: "Massage",
    tagline: "Full-body relaxation to melt away tension",
    intro:
      "Unwind with a soothing full-body massage. Choose a quick 30-minute reset or a full hour of deep relaxation — the perfect finish to your beauty day.",
    keywords: [
      "massage Dubai",
      "full body massage Dubai",
      "relaxation massage Union Metro",
    ],
    image: "/services/massage.jpg",
    items: [
      { name: "Massage — 30 Minutes", price: 100, duration: 30 },
      { name: "Massage — One Hour", price: 150, duration: 60 },
    ],
  },
];

/** Value beauty bundles — combine popular services and save. */
export const PACKAGES: { name: string; price: number; plus?: boolean }[] = [
  { name: "Knotless Exclusive + Eyebrows (razor)", price: 150, plus: true },
  { name: "Boho Exclusive + Gel Polish", price: 200 },
  { name: "Normal Lines + Straightening", price: 50 },
  { name: "Pedicure + Eyebrow (razor)", price: 100 },
  { name: "One by One Lashes + Eyebrows (razor)", price: 100 },
  { name: "Waxing Full Body + Gel Polish", price: 250 },
  { name: "Track and Sew + Gel Polish", price: 200 },
  { name: "Dreadlock Retire", price: 150 },
  { name: "Dread Crochet + Gel Polish", price: 200 },
  { name: "Sisterlocks Retire", price: 300 },
  {
    name: "Half Line + Half Braids + Undo + Wash + Blowdry (incl. Extension)",
    price: 250,
  },
];

export function getCategory(slug: string) {
  return CATEGORIES.find((c) => c.slug === slug);
}

/** Flat list of all bookable services with a stable slug. */
export function allServices() {
  return CATEGORIES.flatMap((cat) =>
    cat.items.map((item) => ({
      ...item,
      category: cat.name,
      categorySlug: cat.slug,
    }))
  );
}
