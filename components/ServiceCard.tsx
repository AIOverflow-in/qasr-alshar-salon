import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import type { ServiceCategory } from "@/lib/services";
import { aed } from "@/lib/utils";

export function ServiceCard({ cat }: { cat: ServiceCategory }) {
  const from = Math.min(...cat.items.map((i) => i.price));
  return (
    <Link
      href={`/services/${cat.slug}`}
      className="surface surface-hover group relative flex flex-col overflow-hidden rounded-2xl"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={cat.image}
          alt={`${cat.name} at Qasr Alshar Salon Dubai`}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        <div className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-ink/70 text-gold opacity-0 backdrop-blur transition-opacity duration-300 group-hover:opacity-100">
          <ArrowUpRight size={18} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-xl text-cream transition-colors group-hover:text-gold">
          {cat.name}
        </h3>
        <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">
          {cat.tagline}
        </p>
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-sand">
            <span className="text-muted">from </span>
            <span className="font-semibold text-gold">{aed(from)}</span>
          </span>
          <span className="text-xs uppercase tracking-wider text-gold/80">
            Explore →
          </span>
        </div>
      </div>
    </Link>
  );
}
