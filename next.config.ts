import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    // Blog hero images are AI-generated and stored in our Vercel Blob store,
    // then rendered via next/image. Allow only our Blob host to be optimized.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
        pathname: "/**",
      },
    ],
  },
  // Baseline security headers on every response. Deliberately NO Content-Security-Policy
  // here — a strict CSP risks breaking Next's inline runtime / images and needs its own
  // tested rollout. These are all safe, no-regression headers: clickjacking protection
  // (same-origin framing still allowed), HTTPS pinning, MIME-sniffing off, tight referrer,
  // and disabling device APIs the site doesn't use.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  // The Jul-2026 menu refresh renamed several category slugs. Keep the old,
  // previously-indexed /services URLs alive with 301s to their replacements.
  async redirects() {
    return [
      { source: "/services/braiding", destination: "/services/braiding-styles", permanent: true },
      { source: "/services/hair", destination: "/services/hair-styling", permanent: true },
      { source: "/services/nails", destination: "/services/hands", permanent: true },
      { source: "/services/makeup", destination: "/services/qasr-glam", permanent: true },
      { source: "/services/waxing", destination: "/services/body-waxing", permanent: true },
      { source: "/services/threading", destination: "/services/face-waxing", permanent: true },
    ];
  },
};

export default nextConfig;
