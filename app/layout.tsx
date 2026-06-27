import type { Metadata, Viewport } from "next";
import { Playfair_Display, Jost, Cairo } from "next/font/google";
import "./globals.css";
import { SITE } from "@/lib/site";
import { getLocale } from "@/lib/i18n/server";
import { dirFor } from "@/lib/i18n/config";
import { localBusinessSchema } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBookingBar } from "@/components/MobileBookingBar";
import { SocialFab } from "@/components/SocialFab";
import { headers } from "next/headers";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});
const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  display: "swap",
});
const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — Beauty Salon in Dubai | Braiding, Hair, Henna & More`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [
    "salon Dubai",
    "beauty salon Dubai",
    "braiding Dubai",
    "henna Dubai",
    "hair salon Union Metro",
    "nail salon Dubai",
    "Qasr Alshar",
  ],
  authors: [{ name: SITE.name }],
  creator: SITE.name,
  alternates: { canonical: SITE.url },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: SITE.locale,
    url: SITE.url,
    title: `${SITE.name} — Beauty Salon in Dubai`,
    description: SITE.description,
    images: [{ url: "/og/default.jpg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — Beauty Salon in Dubai`,
    description: SITE.description,
    images: ["/og/default.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  // Favicon/apple-icon are provided by app/icon.png and app/apple-icon.png
};

export const viewport: Viewport = {
  themeColor: "#0b0a08",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const dir = dirFor(locale);

  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  const isInternal = pathname.startsWith("/admin") || pathname.startsWith("/erp");

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${playfair.variable} ${jost.variable} ${cairo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ink text-cream">
        <JsonLd data={localBusinessSchema()} />
        {!isInternal && <Header />}
        <main className="flex-1 pb-24 lg:pb-0">{children}</main>
        {!isInternal && <Footer />}
        {!isInternal && <MobileBookingBar />}
        {!isInternal && <SocialFab />}
      </body>
    </html>
  );
}
