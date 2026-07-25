import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/shop";
import { CartProvider } from "@/components/shop/cart";
import { AddToCartButton } from "@/components/shop/ProductCard";
import { aed } from "@/lib/utils";
import { pageMeta, breadcrumbSchema } from "@/lib/seo";
import { SITE } from "@/lib/site";
import { JsonLd } from "@/components/JsonLd";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return pageMeta({ title: "Shop", description: "Shop premium hair & aftercare at Qasr Alshar, Dubai.", path: `/shop/${slug}` });
  // og:type stays "website" (pageMeta's default): Next 16 validates og:type against a fixed
  // enum and THROWS on "product", which silently wipes ALL metadata for the route. The rich
  // product data for Google is carried by the Product JSON-LD in the page body instead.
  return pageMeta({
    title: p.name,
    description: p.description || `${p.name} — ${aed(p.priceAED)}. Cash on delivery across the UAE.`,
    path: `/shop/${p.slug}`,
    images: [p.imageUrl],
  });
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) notFound();

  const url = `${SITE.url}/shop/${p.slug}`;
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    image: p.imageUrl?.startsWith("http") ? p.imageUrl : `${SITE.url}${p.imageUrl}`,
    description: p.description || p.name,
    sku: p.id,
    category: p.category,
    brand: { "@type": "Brand", name: SITE.name },
    offers: {
      "@type": "Offer",
      price: p.priceAED,
      priceCurrency: "AED",
      availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url,
      seller: { "@type": "Organization", name: SITE.name },
    },
  };

  return (
    <div className="container-x pb-16 pt-28 md:pt-32">
      <JsonLd data={productSchema} />
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Shop", path: "/shop" }, { name: p.name, path: `/shop/${p.slug}` }])} />
      <Link href="/shop" className="text-sm text-muted hover:text-gold">&larr; Back to shop</Link>
      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-3xl border border-ink-line bg-ink-card">
          <Image src={p.imageUrl || "/gallery/hero.jpg"} alt={p.name} fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" priority />
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-gold">{p.category}</div>
          <h1 className="mt-2 font-display text-4xl text-cream md:text-5xl">{p.name}</h1>
          <div className="mt-3 font-display text-2xl text-gold">{aed(p.priceAED)}</div>
          {p.description && <p className="mt-6 leading-relaxed text-sand/80">{p.description}</p>}
          <div className="mt-6 text-sm text-muted">{p.stock > 0 ? "In stock" : "Out of stock"} &middot; Cash on delivery across the UAE</div>
          <div className="mt-8">
            {p.stock > 0
              ? <CartProvider><AddToCartButton p={p} /></CartProvider>
              : <span className="inline-block rounded-full border border-ink-line px-6 py-3 text-sm text-muted">Out of stock</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
