import Link from "next/link";
import Image from "next/image";
import { aed } from "@/lib/utils";
import type { ShopCard } from "@/lib/shop";

// Server component: a "take-home aftercare" strip of shop products, shown on
// service pages (and reusable on the booking-confirmation surface) to convert
// a service visit into a product sale. Renders nothing when there are no products.
export function RecommendedProducts({
  products,
  title = "Take-home aftercare",
  subtitle = "Keep your look fresh between visits. Delivered across the UAE.",
}: {
  products: ShopCard[];
  title?: string;
  subtitle?: string;
}) {
  if (!products.length) return null;
  return (
    <section className="section-y border-t border-ink-line bg-ink-soft">
      <div className="container-x">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Shop</div>
            <h2 className="mt-2 font-display text-2xl text-cream md:text-3xl">{title}</h2>
            <p className="mt-1 text-sand/80">{subtitle}</p>
          </div>
          <Link href="/shop" className="text-sm text-gold hover:underline">All products &rarr;</Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {products.map((p) => (
            <Link key={p.id} href={`/shop/${p.slug}`} className="group surface overflow-hidden rounded-2xl border border-ink-line transition-colors hover:border-gold/40">
              <div className="relative aspect-square overflow-hidden bg-ink-card">
                <Image
                  src={p.imageUrl || "/gallery/hero.jpg"}
                  alt={p.name}
                  fill
                  sizes="(max-width:768px) 50vw, 25vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-3">
                <div className="line-clamp-1 text-sm text-cream">{p.name}</div>
                <div className="mt-1 text-sm font-semibold text-gold">{aed(p.priceAED)}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
