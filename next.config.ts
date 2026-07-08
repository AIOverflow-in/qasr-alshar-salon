import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
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
