import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Truck, Banknote, Eye, ShieldCheck, MessageCircle } from "lucide-react";
import { getProductForPage, getRelatedProducts } from "@/lib/shop";
import { CartProvider } from "@/components/shop/cart";
import { AddToCartButton } from "@/components/shop/ProductCard";
import { RecommendedProducts } from "@/components/shop/RecommendedProducts";
import { aed, whatsappLink } from "@/lib/utils";
import { pageMeta, breadcrumbSchema } from "@/lib/seo";
import { SITE } from "@/lib/site";
import { JsonLd } from "@/components/JsonLd";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductForPage(slug);
  if (!p) return pageMeta({ title: "Shop", description: "Shop premium hair & aftercare at Qasr Alshar, Dubai.", path: `/shop/${slug}` });
  // og:type stays "website" (pageMeta's default): Next 16 rejects "product" and would wipe metadata.
  return pageMeta({
    title: p.name,
    description: p.description || `${p.name} — ${aed(p.priceAED)}. Cash on delivery across the UAE.`,
    path: `/shop/${p.slug}`,
    images: [p.imageUrl],
  });
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getProductForPage(slug);
  if (!p) notFound();

  const related = await getRelatedProducts(p.category, p.id, 4);
  const inStock = p.stock > 0;
  const isHair = /wig|bundle|weav|extension|\bhair\b|closure|frontal/i.test(p.category);
  const askMsg = inStock
    ? `Hi Qasr Alshar! I'm interested in "${p.name}" (${aed(p.priceAED)}) from your shop. Could you tell me more?`
    : `Hi Qasr Alshar! Is "${p.name}" coming back in stock — can I reserve it?`;
  const wa = whatsappLink(SITE.whatsapp, askMsg);

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
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url,
      seller: { "@type": "Organization", name: SITE.name },
    },
  };

  return (
    <>
      <div className="container-x pb-16 pt-28 md:pt-32">
        <JsonLd data={productSchema} />
        <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Shop", path: "/shop" }, { name: p.name, path: `/shop/${p.slug}` }])} />
        <Link href="/shop" className="text-sm text-muted hover:text-gold">&larr; Back to shop</Link>
        <div className="mt-6 grid gap-10 lg:grid-cols-2">
          <div className="relative aspect-square overflow-hidden rounded-3xl border border-ink-line bg-ink-card">
            <Image src={p.imageUrl || "/gallery/hero.jpg"} alt={p.name} fill sizes="(max-width:1024px) 100vw, 50vw" className={inStock ? "object-cover" : "object-cover opacity-70"} priority />
            {!inStock && <span className="absolute left-4 top-4 rounded-full bg-ink/90 px-3 py-1 text-xs font-semibold text-cream shadow">Sold out</span>}
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-gold">{p.category}</div>
            <h1 className="mt-2 font-display text-4xl text-cream md:text-5xl">{p.name}</h1>
            <div className="mt-3 font-display text-2xl text-gold">{aed(p.priceAED)}</div>
            {p.description && <p className="mt-6 leading-relaxed text-sand/80">{p.description}</p>}

            {/* Trust block — the reassurance a high-ticket, sight-unseen COD buyer needs. */}
            <ul className="mt-6 space-y-2 text-sm text-sand">
              <li className="flex items-center gap-2"><Truck size={16} className="shrink-0 text-gold-deep" /> Free delivery across the UAE</li>
              <li className="flex items-center gap-2"><Banknote size={16} className="shrink-0 text-gold-deep" /> Pay cash on delivery — no online payment</li>
              <li className="flex items-center gap-2"><Eye size={16} className="shrink-0 text-gold-deep" /> Inspect it at your door before you pay</li>
              {isHair && <li className="flex items-center gap-2"><ShieldCheck size={16} className="shrink-0 text-gold-deep" /> 100% human hair, ready to wear</li>}
            </ul>

            <div className="mt-6 text-sm text-muted">{inStock ? "In stock · price includes VAT" : "Currently sold out"}</div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {inStock
                ? <CartProvider><AddToCartButton p={p} /></CartProvider>
                : <span className="inline-flex items-center rounded-full border border-ink-line px-6 py-3 text-sm text-muted">Sold out</span>}
              <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-gold/40 px-5 py-3 text-sm text-gold hover:bg-gold/10">
                <MessageCircle size={16} /> {inStock ? "Ask on WhatsApp" : "Reserve on WhatsApp"}
              </a>
            </div>
          </div>
        </div>
      </div>
      {related.length > 0 && (
        <RecommendedProducts products={related} title="You may also like" subtitle="More from our shop, delivered across the UAE." />
      )}
    </>
  );
}
