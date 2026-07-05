import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/shop";
import { CartProvider } from "@/components/shop/cart";
import { AddToCartButton } from "@/components/shop/ProductCard";
import { aed } from "@/lib/utils";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return pageMeta({ title: "Shop", description: "Shop premium hair & aftercare at Qasr Alshar, Dubai.", path: `/shop/${slug}` });
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

  return (
    <div className="container-x py-12">
      <Link href="/shop" className="text-sm text-muted hover:text-gold">← Back to shop</Link>
      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <div className="overflow-hidden rounded-3xl border border-ink-line bg-ink-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.imageUrl} alt={p.name} className="aspect-square w-full object-cover" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-gold">{p.category}</div>
          <h1 className="mt-2 font-display text-4xl text-cream md:text-5xl">{p.name}</h1>
          <div className="mt-3 font-display text-2xl text-gold">{aed(p.priceAED)}</div>
          {p.description && <p className="mt-6 leading-relaxed text-sand/80">{p.description}</p>}
          <div className="mt-6 text-sm text-muted">{p.stock > 0 ? "In stock" : "Out of stock"} · Cash on delivery across the UAE</div>
          <div className="mt-8">
            <CartProvider><AddToCartButton p={p} /></CartProvider>
          </div>
        </div>
      </div>
    </div>
  );
}
