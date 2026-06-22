import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function PageHero({
  title,
  subtitle,
  eyebrow,
  image = "/salon/salon-styling.jpg",
  crumbs = [],
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  image?: string;
  crumbs?: { name: string; href: string }[];
}) {
  return (
    <section className="relative flex min-h-[46svh] items-end overflow-hidden pt-24">
      <Image
        src={image}
        alt={title}
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      {/* vivid image with a rich dark scrim; bottom blends into the bright page */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/25" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-ink" />
      <div className="container-x relative z-10 pb-12">
        {crumbs.length > 0 && (
          <nav className="mb-4 flex items-center gap-1.5 text-xs text-white/70">
            <Link href="/" className="hover:text-gold-bright">Home</Link>
            {crumbs.map((c) => (
              <span key={c.href} className="flex items-center gap-1.5">
                <ChevronRight size={13} />
                <Link href={c.href} className="hover:text-gold-bright">{c.name}</Link>
              </span>
            ))}
          </nav>
        )}
        {eyebrow && (
          <div className="mb-3 text-xs font-medium uppercase tracking-[0.3em] text-gold-bright">
            {eyebrow}
          </div>
        )}
        <h1 className="font-display text-4xl text-white md:text-6xl">{title}</h1>
        {subtitle && (
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/85">
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
