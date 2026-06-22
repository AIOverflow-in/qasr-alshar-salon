import type { Metadata } from "next";
import { SITE } from "./site";

/** Build consistent page metadata with sensible OG/Twitter defaults. */
export function pageMeta(opts: {
  title?: string;
  description?: string;
  path?: string;
  images?: string[];
  keywords?: string[];
}): Metadata {
  const title = opts.title ? `${opts.title} | ${SITE.name}` : SITE.name;
  const description = opts.description ?? SITE.description;
  const url = `${SITE.url}${opts.path ?? ""}`;
  const images = opts.images ?? ["/og/default.jpg"];

  return {
    title,
    description,
    keywords: opts.keywords,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE.name,
      locale: SITE.locale,
      type: "website",
      images: images.map((u) => ({ url: u, width: 1200, height: 630 })),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images,
    },
  };
}

/** schema.org LocalBusiness (HairSalon) JSON-LD. */
export function localBusinessSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "HairSalon",
    "@id": `${SITE.url}/#salon`,
    name: SITE.name,
    image: `${SITE.url}/og/default.jpg`,
    url: SITE.url,
    telephone: SITE.phones[0].value,
    priceRange: "AED 10 – AED 400",
    currenciesAccepted: "AED",
    address: {
      "@type": "PostalAddress",
      streetAddress: SITE.address.line1,
      addressLocality: SITE.address.city,
      addressCountry: SITE.address.countryCode,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: SITE.address.lat,
      longitude: SITE.address.lng,
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ],
        opens: SITE.hours.open,
        closes: SITE.hours.close,
      },
    ],
    sameAs: [
      SITE.social.instagram,
      SITE.social.tiktok,
      SITE.social.facebook,
      SITE.social.snapchat,
    ],
    areaServed: { "@type": "City", name: "Dubai" },
  };
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SITE.url}${it.path}`,
    })),
  };
}

export function faqSchema(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}
