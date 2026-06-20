import Image from "next/image";
import { MapPin, Clock, ShieldCheck, Sparkles } from "lucide-react";
import { ButtonLink } from "../ui/Button";
import { SITE } from "@/lib/site";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function Hero({ t }: { t: Dictionary }) {
  return (
    <section className="relative flex min-h-[100svh] items-center overflow-hidden">
      <Image
        src="/gallery/hero-model.jpg"
        alt="Woman with long knotless braids at Qasr Alshar Salon, Dubai"
        fill
        priority
        sizes="100vw"
        className="object-cover object-right"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/80 via-ink/65 to-ink" />
      <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/40 to-transparent" />

      <div className="container-x relative z-10 pt-28 pb-24">
        <div className="max-w-2xl reveal">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-ink/50 px-4 py-1.5 text-xs uppercase tracking-[0.28em] text-gold backdrop-blur">
            <MapPin size={13} /> {t.hero.eyebrow}
          </div>

          <h1 className="font-display text-5xl leading-[1.05] text-cream sm:text-6xl md:text-7xl">
            <span className="text-gold-gradient">{t.hero.title}</span>
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

          <ul className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-sand/85">
            <li className="flex items-center gap-2">
              <Clock size={15} className="text-gold" /> {t.common.openDaily}
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck size={15} className="text-gold" /> Sterilised, single-use tools
            </li>
            <li className="flex items-center gap-2">
              <Sparkles size={15} className="text-gold" /> Every hair type & culture
            </li>
            <li>
              <a
                href={SITE.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold transition-colors hover:text-gold-bright"
              >
                {SITE.social.instagramHandle}
              </a>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
