import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ShopCard } from "@/lib/shop";
import { CartProvider } from "./cart";
import { ProductCard } from "./ProductCard";

/** Homepage teaser: a few products + a link to the full /shop page. Cart works here too. */
export function ShopSection({ products }: { products: ShopCard[] }) {
  if (!products.length) return null;
  const featured = products.slice(0, 8);

  return (
    <CartProvider>
      <section id="shop" className="container-x scroll-mt-24 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">The Shop</div>
          <h2 className="mt-3 font-display text-4xl text-cream">Take the salon home</h2>
          <p className="mt-3 text-sand/80">Premium hair &amp; aftercare, delivered across the UAE. Pay cash on delivery.</p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {featured.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>

        <div className="mt-12 text-center">
          <Link href="/shop" className="inline-flex items-center gap-2 rounded-full border border-gold/40 px-6 py-3 text-sm font-semibold text-gold hover:bg-gold/10">
            Shop all products <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </CartProvider>
  );
}
