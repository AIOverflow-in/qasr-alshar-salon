/**
 * Qasr Alshar Salon — full service catalogue (prices in AED, INCLUSIVE of 5% VAT).
 * Transcribed from the official salon price list ("Qasr Price List", Jul 2026),
 * then raised by 5% and made VAT-inclusive (Jul 2026): the listed price is the
 * all-in amount the customer pays; receipts read "includes all taxes". The net
 * (ex-VAT) and VAT portions are computed out of the total at POS via lib/vat-core.
 * This is the canonical source consumed by marketing pages, the public booking
 * page ordering, and the Prisma seed / service sync (scripts/sync-services.ts).
 *
 * Length tiers that the price list labels explicitly (Short / Medium / Long /
 * Extra Long) are split into their own bookable rows so POS charges the exact
 * price. Open ranges the list gives as "158–368" or "315/368/420/473" are a
 * single row priced at the starting figure (plus:true → shown as "AED 158+")
 * with the full range in `note`.
 */

export type ServiceItem = {
  name: string;
  price: number;
  /** estimated duration in minutes — drives booking slot length */
  duration: number;
  /** show the price as a "from" figure (renders "AED 150+") */
  plus?: boolean;
  /** optional clarifier shown under the item (tier breakdown, conditions) */
  note?: string;
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
    slug: "cornrow-styles",
    name: "Cornrow Styles",
    tagline: "Sleek updos, downdos, half-lines & wig-line prep",
    intro:
      "Cornrows are the heart of protective styling, and our braiders lay them with a clean, low-tension parting that lasts. Choose a sculpted line updo, a flowing downdo, half lines or quick wig-prep lines. Design and detail drive the price, so send us a reference photo on WhatsApp for an exact quote on your length and pattern.",
    keywords: [
      "cornrows Dubai",
      "cornrow updo Dubai",
      "feed-in cornrows Dubai",
      "protective styling Dubai",
      "Afro hair salon Dubai",
    ],
    image: "/work/hair/braiding-cornrows-01.jpg",
    items: [
      { name: "Cornrow Updo", price: 315, duration: 240 },
      { name: "Cornrow Downdo", price: 158, duration: 180, plus: true, note: "AED 158–368 depending on design" },
      { name: "Half Lines", price: 210, duration: 150, plus: true, note: "AED 210–368 depending on design" },
      { name: "Wig Lines (cornrow base)", price: 63, duration: 90, plus: true, note: "AED 63–210 depending on design" },
    ],
  },
  {
    slug: "braiding-styles",
    name: "Braiding Styles",
    tagline: "Boho, knotless, French curls, bonestraight & human-hair braids",
    intro:
      "From boho and knotless braids to French curls, bonestraight and premium human-hair braids, our braiders specialise in gentle, natural-looking installs for Afro-textured hair. Prices below are for a small size to mid-back length; we can go larger, longer or add extensions for a small extra charge. Book a consultation and we'll match the style to your hair and lifestyle.",
    keywords: [
      "knotless braids Dubai",
      "boho braids Dubai",
      "box braids Dubai",
      "French curls Dubai",
      "human hair braids Dubai",
    ],
    image: "/work/hair/braiding-knotless-01.jpg",
    items: [
      { name: "Boho Braids (Human Hair)", price: 368, duration: 300, note: "Small · mid-back — extendable for an extra charge" },
      { name: "Boho Braids (Synthetic)", price: 315, duration: 300, note: "Small · mid-back" },
      { name: "Knotless Braids", price: 263, duration: 240, note: "Medium · mid-back" },
      { name: "French Curls", price: 263, duration: 240, note: "Medium · mid-back" },
      { name: "Bonestraight Braids", price: 420, duration: 300, note: "Small · mid-back" },
      { name: "Human Hair Braids", price: 473, duration: 300, note: "Small · mid-back" },
      { name: "Caribbean Braids", price: 420, duration: 300, note: "Small · mid-back" },
    ],
  },
  {
    slug: "locks",
    name: "Locs & Dreadlocks",
    tagline: "Dreadlocks, artificial, human-hair, sister & micro locs",
    intro:
      "Start your dreadlock journey with a clean, deliberate installation. We offer artificial and human-hair locs (dreadlocks), plus precise sister locks and micro locks for a fine, versatile grid. Every install is sectioned by hand for even, healthy locs that mature beautifully. Retwists, crochet reattach and maintenance are available on request.",
    keywords: [
      "dreadlocks Dubai",
      "locs Dubai",
      "sister locks Dubai",
      "micro locks Dubai",
      "loc installation Dubai",
      "dreadlock retwist Dubai",
      "natural hair Dubai",
    ],
    image: "/work/hair/braiding-sisterlocks-01.jpg",
    items: [
      { name: "Artificial Locks (New Installation)", price: 525, duration: 300 },
      { name: "Human Hair Locks (New Installation)", price: 525, duration: 300 },
      { name: "Sister Locks (New Installation)", price: 1575, duration: 360 },
      { name: "Micro Locks (New Installation)", price: 2100, duration: 360 },
    ],
  },
  {
    slug: "hair-styling",
    name: "Hair Styling",
    tagline: "Blow dry, brushing & Hollywood waves — priced by length",
    intro:
      "A great blow dry sets everything off. Choose a classic smooth blow dry, a bouncy brushing finish, or glamorous Hollywood waves — priced by your hair length from short to extra long. Perfect on its own or as the finishing touch to colour or treatment.",
    keywords: [
      "blow dry Dubai",
      "Hollywood waves Dubai",
      "hair styling Dubai",
      "hair salon Union Metro",
    ],
    image: "/services/svc-hair-styling.jpg",
    items: [
      { name: "Blow Dry Classic (Short)", price: 189, duration: 45 },
      { name: "Blow Dry Classic (Medium)", price: 210, duration: 45 },
      { name: "Blow Dry Classic (Long)", price: 231, duration: 60 },
      { name: "Blow Dry Classic (Extra Long)", price: 263, duration: 60 },
      { name: "Blow Dry Brushing (Short)", price: 210, duration: 45 },
      { name: "Blow Dry Brushing (Medium)", price: 231, duration: 45 },
      { name: "Blow Dry Brushing (Long)", price: 252, duration: 60 },
      { name: "Blow Dry Brushing (Extra Long)", price: 273, duration: 60 },
      { name: "Hollywood Waves (Short)", price: 231, duration: 60 },
      { name: "Hollywood Waves (Medium)", price: 263, duration: 60 },
      { name: "Hollywood Waves (Long)", price: 315, duration: 75 },
      { name: "Hollywood Waves (Extra Long)", price: 368, duration: 75 },
    ],
  },
  {
    slug: "haircut",
    name: "Haircut",
    tagline: "Fringe, trims, styling cuts & kids' cuts",
    intro:
      "A precise cut from a stylist who listens. From a quick fringe tidy and a healthy trim to a full styling haircut and gentle kids' cuts, we shape to suit your face and hair type. Add a blow dry to finish.",
    keywords: [
      "haircut Dubai",
      "ladies haircut Dubai",
      "kids haircut Dubai",
      "fringe cut Dubai",
    ],
    image: "/work/hair/haircut-pixie-01.jpg",
    items: [
      { name: "Fringe Cut", price: 158, duration: 30 },
      { name: "Trimming", price: 210, duration: 45 },
      { name: "Styling Haircut", price: 368, duration: 60 },
      { name: "Kids Cut", price: 158, duration: 30 },
    ],
  },
  {
    slug: "hairstyling-caucasian",
    name: "Hairstyling — Caucasian Hair",
    tagline: "Blow dry, brushing, waves & creative styling for straight/wavy hair",
    intro:
      "Styling tuned for Caucasian and straight-to-wavy hair — smooth blow dries, brushing, Hollywood waves, chic ponytails and creative event styling. Prices scale with length; ask us for an exact quote for your hair.",
    keywords: [
      "blow dry Dubai",
      "hair styling Dubai",
      "event hairstyle Dubai",
      "ponytail styling Dubai",
    ],
    image: "/services/svc-hairstyling-caucasian.jpg",
    items: [
      { name: "Blow Dry Classic", price: 189, duration: 45, plus: true, note: "By length: 189 / 210 / 231 / 263" },
      { name: "Blow Dry Brushing", price: 210, duration: 45, plus: true, note: "By length: 210 / 231 / 252 / 273 / 294" },
      { name: "Hollywood Waves", price: 210, duration: 60, plus: true, note: "By length: 210 / 231 / 263 / 315 / 368" },
      { name: "Chic Ponytail", price: 158, duration: 45 },
      { name: "Creative Hairstyle", price: 368, duration: 60 },
      { name: "Quick Wash & Dry", price: 105, duration: 30 },
    ],
  },
  {
    slug: "hair-coloring",
    name: "Hair Coloring",
    tagline: "Roots, toner, full colour, air touch, balayage & bleach",
    intro:
      "Colour done properly, by stylists who protect your hair's integrity. From root touch-ups and toners to full colour, air touch, balayage, ombré, shatush and bleach. Colour is priced by length and technique — the figures below start from short hair; book a consultation for an exact quote.",
    keywords: [
      "hair colour Dubai",
      "balayage Dubai",
      "air touch Dubai",
      "highlights Dubai",
      "bleach hair Dubai",
    ],
    image: "/services/svc-hair-coloring.jpg",
    items: [
      { name: "Roots Coloring (up to 7cm)", price: 368, duration: 90 },
      { name: "Toner", price: 315, duration: 90, plus: true, note: "By length: 315 / 368 / 420 / 473" },
      { name: "Full Hair Colour", price: 473, duration: 150, plus: true, note: "By length: 473 / 525 / 578 / 630" },
      { name: "Air Touch", price: 1470, duration: 240, plus: true, note: "By length: 1470 / 1680 / 1890 / 2100 / 2310" },
      { name: "Brazilian Blond / Ombré / Balayage / Shatush", price: 1050, duration: 240, plus: true, note: "By length: 1050 / 1260 / 1470 / 1680 / 1890 / 2100" },
      { name: "Bleach", price: 525, duration: 120 },
    ],
  },
  {
    slug: "hair-treatment",
    name: "Hair Treatment",
    tagline: "K18, Tokio, Olaplex, keratin, botox & bond repair",
    intro:
      "Restore strength and shine with professional bond and smoothing treatments — K18, Tokio Inkarami, Absolute Happiness, Olaplex, Davines, keratin and hair botox — plus express masques from Amika, Camille Rose, Fenty, Batana, Moringa, Chebe, Biolage and Mizani. Full treatments are priced by length (short to extra long); express masques are single-price add-ons.",
    keywords: [
      "keratin treatment Dubai",
      "hair botox Dubai",
      "Olaplex Dubai",
      "K18 Dubai",
      "hair treatment Union Metro",
    ],
    image: "/services/svc-hair-treatment.jpg",
    items: [
      { name: "K18 Treatment (Short)", price: 368, duration: 60 },
      { name: "K18 Treatment (Medium)", price: 473, duration: 75 },
      { name: "K18 Treatment (Long)", price: 578, duration: 75 },
      { name: "K18 Treatment (Extra Long)", price: 683, duration: 90 },
      { name: "Tokio Inkarami (Short)", price: 735, duration: 90 },
      { name: "Tokio Inkarami (Medium)", price: 840, duration: 90 },
      { name: "Tokio Inkarami (Long)", price: 945, duration: 105 },
      { name: "Tokio Inkarami (Extra Long)", price: 1050, duration: 120 },
      { name: "Absolute Happiness (Short)", price: 368, duration: 90 },
      { name: "Absolute Happiness (Medium)", price: 420, duration: 90 },
      { name: "Absolute Happiness (Long)", price: 473, duration: 105 },
      { name: "Absolute Happiness (Extra Long)", price: 578, duration: 120 },
      { name: "Olaplex Full (Short)", price: 420, duration: 90 },
      { name: "Olaplex Full (Medium)", price: 473, duration: 90 },
      { name: "Olaplex Full (Long)", price: 525, duration: 105 },
      { name: "Olaplex Full (Extra Long)", price: 578, duration: 120 },
      { name: "Davines (Short)", price: 368, duration: 90 },
      { name: "Davines (Medium)", price: 420, duration: 90 },
      { name: "Davines (Long)", price: 473, duration: 105 },
      { name: "Davines (Extra Long)", price: 525, duration: 120 },
      { name: "Keratin (Short)", price: 945, duration: 120 },
      { name: "Keratin (Medium)", price: 1260, duration: 150 },
      { name: "Keratin (Long)", price: 1575, duration: 180 },
      { name: "Keratin (Extra Long)", price: 1890, duration: 180 },
      { name: "Hair Botox (Short)", price: 840, duration: 120 },
      { name: "Hair Botox (Medium)", price: 1050, duration: 150 },
      { name: "Hair Botox (Long)", price: 1260, duration: 180 },
      { name: "Hair Botox (Extra Long)", price: 1470, duration: 180 },
      { name: "Keratin Fringe Only", price: 315, duration: 45 },
      { name: "Olaplex Repair Express", price: 210, duration: 45 },
      { name: "Tokio Inkarami Express", price: 420, duration: 60 },
      { name: "Amika Masque", price: 315, duration: 45 },
      { name: "Camille Rose Masque", price: 210, duration: 45 },
      { name: "Fenty Masque", price: 315, duration: 45 },
      { name: "Batana Masque", price: 368, duration: 45 },
      { name: "Moringa Masque", price: 368, duration: 45 },
      { name: "Chebe Masque", price: 368, duration: 45 },
      { name: "Biolage Masque", price: 368, duration: 45 },
      { name: "Mizani Masque", price: 210, duration: 45 },
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
    image: "/work/hair/wig-01.jpg",
    items: [
      { name: "Track and Sew", price: 210, duration: 150 },
      { name: "Weaving", price: 263, duration: 180 },
      { name: "Wig Installation", price: 53, duration: 60 },
      { name: "Wig Wash", price: 53, duration: 45 },
      { name: "Wig Making", price: 315, duration: 240 },
      { name: "Wig Revamping", price: 263, duration: 180 },
    ],
  },
  {
    slug: "qasr-glam",
    name: "Qasr Glam",
    tagline: "Soft glam, full beat & bridal artistry",
    intro:
      "Makeup that lasts all day and photographs beautifully. From an effortless soft glam to a full-face beat, and our signature bridal tiers — Classic, Diamond and the Qasr Lux Bridal Experience — our artists create looks tailored to you. We also cover photoshoot and dessert-shoot glam for content and campaigns.",
    keywords: [
      "makeup artist Dubai",
      "bridal makeup Dubai",
      "soft glam Dubai",
      "photoshoot makeup Dubai",
      "full glam Dubai",
    ],
    image: "/services/svc-qasr-glam.jpg",
    items: [
      { name: "Soft Glam", price: 735, duration: 60 },
      { name: "Full Face Beat", price: 1050, duration: 90 },
      { name: "Classic Bridal", price: 1260, duration: 150 },
      { name: "Diamond Bridal", price: 1575, duration: 150 },
      { name: "Qasr Lux Bridal Experience", price: 2100, duration: 180 },
      {
        name: "Photoshoot Glam",
        price: 1260,
        duration: 180,
        note: "3-hour service with on-set touch-ups. Extra hours AED 368/hr. One location within 20km; dessert-shoot rates differ.",
      },
      { name: "Dessert Shoot Glam", price: 1575, duration: 180 },
    ],
  },
  {
    slug: "hands",
    name: "Hands",
    tagline: "Manicures, gelish, overlays, extensions & refills",
    intro:
      "Beautifully finished hands in a relaxing setting. Choose a Japanese or classic manicure, gelish, a spa treatment, hard-gel overlay, or nail extensions by length with refills and removal. Our technicians work hygienically with premium products.",
    keywords: [
      "manicure Dubai",
      "gelish Dubai",
      "nail extensions Dubai",
      "Japanese manicure Dubai",
      "nail salon Union Metro",
    ],
    image: "/work/nails/nail-manicure-01.jpg",
    items: [
      { name: "Japanese Manicure", price: 210, duration: 60 },
      { name: "Manicure Classic", price: 168, duration: 45 },
      { name: "Manicure Gelish", price: 242, duration: 60 },
      { name: "Spa Treatment (Hands)", price: 158, duration: 45 },
      { name: "Hard Gel Overlay", price: 294, duration: 75 },
      { name: "Nail Extension (up to 5mm)", price: 420, duration: 90 },
      { name: "Nail Extension (5–10mm)", price: 473, duration: 90 },
      { name: "Nail Extension (10mm+)", price: 525, duration: 105 },
      { name: "Nail Extension Refill (Short)", price: 315, duration: 75 },
      { name: "Nail Extension Refill (Long)", price: 399, duration: 90 },
      { name: "Nail Extension Removal", price: 105, duration: 30 },
    ],
  },
  {
    slug: "podology",
    name: "Feet & Podology",
    tagline: "Smart-filing pedicures, medical care & titanium braces",
    intro:
      "Pedicures and clinical foot care under one roof. From classic and gelish smart-filing pedicures to a smart medical pedicure for ingrown nails, cracks, corns and heels — plus podology add-ons like callus treatment, prosthetics and titanium brace correction. Gentle, hygienic and results-driven.",
    keywords: [
      "pedicure Dubai",
      "medical pedicure Dubai",
      "ingrown nail treatment Dubai",
      "podology Dubai",
      "callus treatment Dubai",
    ],
    image: "/work/nails/pedicure-new-01.jpg",
    items: [
      { name: "Pedicure Classic (Smart Filing)", price: 210, duration: 60 },
      { name: "Pedicure Gelish (Smart Filing)", price: 294, duration: 75 },
      { name: "Smart Medical Pedicure", price: 368, duration: 90, note: "Ingrown nails, cracks, corns & heel treatment" },
      { name: "Spa Treatment (Feet)", price: 158, duration: 45 },
      { name: "Ingrown Nail Removal", price: 42, duration: 30 },
      { name: "Corn / Blister Removal", price: 158, duration: 45 },
      { name: "Callus Treatment (Keratolytic)", price: 158, duration: 45 },
      { name: "Pseudomonas Bacteria Chemical Removal", price: 158, duration: 45, plus: true, note: "from AED 158" },
      { name: "Prosthetics", price: 158, duration: 45 },
      { name: "Titanium Brace Installation", price: 630, duration: 60 },
      { name: "Titanium Brace Refill", price: 420, duration: 45 },
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
    image: "/services/svc-facial.jpg",
    items: [
      { name: "14-Step HydraFacial (Signature)", price: 580, duration: 90, note: "Our advanced 14-step deep cleanse, extract, infuse & glow" },
      { name: "14-Step HydraFacial (Express)", price: 380, duration: 60 },
      { name: "Classic Facial", price: 105, duration: 60 },
      { name: "Hydra Facial", price: 263, duration: 75 },
      { name: "Face Brightening", price: 105, duration: 45 },
      { name: "Hand Brightening", price: 158, duration: 45 },
      { name: "Feet Brightening", price: 158, duration: 45 },
      { name: "Full Body Brightening", price: 263, duration: 90 },
    ],
  },
  {
    slug: "face-waxing",
    name: "Face Threading & Waxing",
    tagline: "Brows, lips, chin & full-face shaping",
    intro:
      "Crisp, precise threading and waxing for the face — brows shaped to suit you, plus upper lip, chin, nose, forehead, sides and full face. Quick, hygienic and gentle on sensitive skin.",
    keywords: [
      "threading Dubai",
      "eyebrow threading Dubai",
      "face waxing Dubai",
      "brow shaping Dubai",
    ],
    image: "/services/threading.jpg",
    items: [
      { name: "Upper Lip", price: 26, duration: 15 },
      { name: "Chin", price: 26, duration: 15 },
      { name: "Nose", price: 21, duration: 15 },
      { name: "Forehead", price: 26, duration: 15 },
      { name: "Eyebrows", price: 47, duration: 20 },
      { name: "Face (Sides)", price: 47, duration: 20 },
      { name: "Full Face", price: 95, duration: 30 },
    ],
  },
  {
    slug: "body-waxing",
    name: "Body Waxing",
    tagline: "Arms, legs, underarms, bikini & full body",
    intro:
      "Smooth, glowing skin with gentle, hygienic waxing — arms, legs, underarms, bikini, Brazilian and full body. We use quality wax and a careful technique for comfortable results that last.",
    keywords: [
      "waxing Dubai",
      "full body wax Dubai",
      "bikini wax Dubai",
      "Brazilian wax Dubai",
      "leg wax Dubai",
    ],
    image: "/services/waxing.jpg",
    items: [
      { name: "Under Arms", price: 32, duration: 20 },
      { name: "Half Arms", price: 63, duration: 25 },
      { name: "Full Arms", price: 95, duration: 30 },
      { name: "Half Legs", price: 84, duration: 30 },
      { name: "Full Legs", price: 137, duration: 45 },
      { name: "Bikini", price: 105, duration: 30 },
      { name: "Brazilian", price: 158, duration: 40 },
      { name: "Full Body Wax", price: 315, duration: 90 },
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
      { name: "Eye Lashes Curly", price: 53, duration: 45 },
      { name: "Eyelashes Extension", price: 105, duration: 90 },
      { name: "One by One Lashes", price: 158, duration: 120 },
      { name: "Three by Three Lashes", price: 84, duration: 75 },
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
    image: "/work/henna/henna-hand-01.jpg",
    items: [
      { name: "Henna — One Side", price: 105, duration: 45 },
      { name: "Henna — Leg", price: 105, duration: 45 },
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
      { name: "Massage — 30 Minutes", price: 105, duration: 30 },
      { name: "Massage — One Hour", price: 158, duration: 60 },
    ],
  },
];

/** Value beauty bundles — combine popular services and save. */
export const PACKAGES: { name: string; price: number; plus?: boolean }[] = [
  { name: "Knotless Exclusive + Eyebrows (razor)", price: 158, plus: true },
  { name: "Boho Exclusive + Gel Polish", price: 210 },
  { name: "Normal Lines + Straightening", price: 53 },
  { name: "Pedicure + Eyebrow (razor)", price: 105 },
  { name: "One by One Lashes + Eyebrows (razor)", price: 105 },
  { name: "Waxing Full Body + Gel Polish", price: 263 },
  { name: "Track and Sew + Gel Polish", price: 210 },
  { name: "Dreadlock Retire", price: 158 },
  { name: "Dread Crochet + Gel Polish", price: 210 },
  { name: "Sisterlocks Retire", price: 315 },
  {
    name: "Half Line + Half Braids + Undo + Wash + Blowdry (incl. Extension)",
    price: 263,
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
