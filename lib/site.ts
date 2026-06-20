/**
 * Central business configuration for Qasr Alshar Salon.
 * Single source of truth used across SEO, footer, contact, schema.org, etc.
 */

export const SITE = {
  name: "Qasr Alshar Salon",
  shortName: "Qasr Alshar",
  tagline: "Dubai's Crown of Beauty",
  description:
    "Qasr Alshar Salon in Dubai — expert braiding, weaving, hair, nails, facials, makeup, henna, lashes, waxing & massage. Book your appointment online at Dalmok Series Building, Union Metro.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://qasr-alshar.netlify.app",
  locale: "en_AE",

  address: {
    line1: "Dalmok Series Building, Exit 2, Union Metro",
    city: "Dubai",
    country: "United Arab Emirates",
    countryCode: "AE",
    // Approximate Union Metro / Deira coordinates (update with exact pin)
    lat: 25.2657,
    lng: 55.3203,
    mapsQuery: "Qasr+Alshar+Salon+Dalmok+Series+Building+Union+Metro+Dubai",
  },

  phones: [
    { label: "+971 58 245 7913", value: "+971582457913" },
    { label: "+971 58 891 3535", value: "+971588913535" },
    { label: "+971 50 623 0567", value: "+971506230567" },
    { label: "+971 4 272 7616", value: "+97142727616" },
  ],
  // Primary booking / WhatsApp line
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "+971506230567",
  email: "hello@qasralshar.ae",

  social: {
    instagram: "https://instagram.com/qasr.alshar",
    instagramHandle: "@qasr.alshar",
    tiktok: "https://www.tiktok.com/@qasralsharsalon",
    tiktokHandle: "@qasralsharsalon",
  },

  // Default opening hours (editable in admin → WorkingHours)
  hours: {
    open: "10:00",
    close: "22:00",
    note: "Open Daily · 10:00 AM – 10:00 PM",
  },
} as const;

export type Phone = (typeof SITE.phones)[number];
