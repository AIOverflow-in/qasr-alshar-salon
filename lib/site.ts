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
    lat: 25.264521,
    lng: 55.315475,
    mapsQuery: "Qasr+Alshar+Salon+Dalmok+Series+Building+Union+Metro+Dubai",
    mapsEmbed: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d227.3!2d55.315475!3d25.264521!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMjXCsDE1JzUyLjMiTiA1NcKwMTgnNTUuNyJF!5e0!3m2!1sen!2sae!4v1",
  },

  phones: [
    { label: "+971 4 272 7616", value: "+97142727616" },
    { label: "+971 58 245 7913", value: "+971582457913" },
    { label: "+971 58 891 3535", value: "+971588913535" },
    { label: "+971 50 623 0567", value: "+971506230567" },
  ],
  // Primary booking / WhatsApp line
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "+97142727616",
  email: "hello@qasralshar.ae",

  social: {
    instagram: "https://www.instagram.com/qasr.alshar?igsh=N3Z0MG1lb2YwMTVs&utm_source=qr",
    instagramHandle: "@qasr.alshar",
    tiktok: "https://www.tiktok.com/@qasralsharsalon",
    tiktokHandle: "@qasralsharsalon",
    facebook: "https://www.facebook.com/profile.php?id=61583884163475",
    facebookHandle: "Qasr Alshar Salon",
    snapchat: "https://snapchat.com/t/tlRZdF42",
    snapchatHandle: "@qasralshar",
    googleBusiness:
      process.env.NEXT_PUBLIC_GOOGLE_BUSINESS_URL ||
      `https://www.google.com/maps/search/?api=1&query=Qasr+Alshar+Salon+Dalmok+Series+Building+Union+Metro+Dubai`,
  },

  // Default opening hours (editable in admin → WorkingHours)
  hours: {
    open: "10:00",
    close: "22:00",
    note: "Open Daily · 10:00 AM – 10:00 PM",
  },
} as const;

export type Phone = (typeof SITE.phones)[number];
