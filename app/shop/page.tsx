import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedProducts } from "@/lib/shop";
import { CartProvider } from "@/components/shop/cart";
import { ProductCard } from "@/components/shop/ProductCard";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Shop — Premium Hair & Aftercare",
  description: "Shop premium hair extensions and salon aftercare from Qasr Alshar, Dubai. Cash on delivery across the UAE.",
  path: "/shop",
});

export default async function ShopPage() {
  const products = await getPublishedProducts();

  return (
    <div className="container-x py-16">
      <div className="mx-auto max-w-2xl text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">The Shop</div>
        <h1 className="mt-3 font-display text-4xl text-cream md:text-5xl">Premium hair &amp; aftercare</h1>
        <p className="mt-3 text-sand/80">Delivered across the UAE — pay cash on delivery.</p>
      </div>

      {products.length === 0 ? (
        <div className="mt-16 text-center text-muted">
          <p>Our shop is being stocked — check back very soon.</p>
          <Link href="/" className="mt-4 inline-block text-gold hover:underline">Back to home</Link>
        </div>
      ) : (
        <CartProvider>
          <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        </CartProvider>
      )}
    </div>
  );
}
