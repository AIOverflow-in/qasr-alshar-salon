import Image from "next/image";
import { Star, MapPin } from "lucide-react";
import { ButtonLink } from "../ui/Button";
import { SITE } from "@/lib/site";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function Hero({ t }: { t: Dictionary }) {
  return (
    <section className="relative flex min-h-[100svh] items-center overflow-hidden">
      <Image
        src="/gallery/hero.jpg"
        alt="Luxury interior of Qasr Alshar Salon in Dubai"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/85 via-ink/70 to-ink" />
      <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(200,162,76,0.12),transparent)]" />

      <div className="container-x relative z-10 pt-28 pb-24">
        <div className="max-w-2xl reveal">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-ink/40 px-4 py-1.5 text-xs uppercase tracking-[0.28em] text-gold backdrop-blur">
            <MapPin size={13} /> {t.hero.eyebrow}
          </div>

          <h1 className="font-display text-5xl leading-[1.05] text-cream sm:text-6xl md:text-7xl">
            <span className="text-gold-shimmer">{t.hero.title}</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-sand/90">
            {t.hero.subtitle}
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <ButtonLink href="/book" size="lg">
              {t.hero.cta}
            </ButtonLink>
            <ButtonLink href="/services" size="lg" variant="outline">
              {t.hero.secondary}
            </ButtonLink>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 text-sm text-sand/80">
            <div className="flex items-center gap-2">
              <div className="flex text-gold">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={15} fill="currentColor" />
                ))}
              </div>
              <span>Loved across Dubai</span>
            </div>
            <div className="h-4 w-px bg-ink-line" />
            <a
              href={SITE.social.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-gold"
            >
              {SITE.social.instagramHandle}
            </a>
            <div className="h-4 w-px bg-ink-line" />
            <span>{t.common.openDaily}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
