import Image from "next/image";
import { MapPin, Clock, ShieldCheck, Sparkles } from "lucide-react";
import { ButtonLink } from "../ui/Button";
import { SITE } from "@/lib/site";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function Hero({ t }: { t: Dictionary }) {
  return (
    <section className="relative flex min-h-[100svh] items-center overflow-hidden">
      <Image
        src="/salon/salon-main.jpg"
        alt="Interior of Qasr Alshar Salon, Union Metro, Dubai"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      {/* keep the photo vivid: rich left scrim for text, image stays saturated */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-black/10" />
      {/* blend the bottom edge into the bright page below */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ink" />

      <div className="container-x relative z-10 pt-28 pb-24">
        <div className="max-w-2xl reveal">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-black/30 px-4 py-1.5 text-xs uppercase tracking-[0.28em] text-gold-bright backdrop-blur">
            <MapPin size={13} /> {t.hero.eyebrow}
          </div>

          <h1 className="font-display text-5xl leading-[1.05] sm:text-6xl md:text-7xl">
            <span className="text-gold-gradient">{t.hero.title}</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#efe7d6]">
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

          <ul className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-[#efe7d6]/90">
            <li className="flex items-center gap-2">
              <Clock size={15} className="text-gold-bright" /> {t.common.openDaily}
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck size={15} className="text-gold-bright" /> Sterilised, single-use tools
            </li>
            <li className="flex items-center gap-2">
              <Sparkles size={15} className="text-gold-bright" /> Every hair type & culture
            </li>
            <li>
              <a
                href={SITE.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold-bright transition-colors hover:text-white"
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
