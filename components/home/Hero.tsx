import Image from "next/image";
import Link from "next/link";
import { MapPin, Clock, ArrowRight } from "lucide-react";
import { ButtonLink } from "../ui/Button";
import { SITE } from "@/lib/site";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function Hero({ t }: { t: Dictionary }) {
  return (
    <section className="flex min-h-[100svh] flex-col lg:flex-row">

      {/* ── Right panel: full-vivid photo, no overlay ─────────────────── */}
      <div className="relative h-[56vw] shrink-0 sm:h-[480px] lg:h-auto lg:w-[52%]">
        <Image
          src="/salon/hero-salon.jpg"
          alt="Qasr Alshar Salon interior — gold-accented styling chairs and floral ceiling, near Union Metro, Dubai"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 52vw"
          className="object-cover"
        />
        {/* subtle bottom fade so the panel meets the white section below on mobile */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-ink lg:hidden" />
      </div>

      {/* ── Left panel: text on warm white ────────────────────────────── */}
      <div className="relative flex flex-1 flex-col justify-center bg-ink px-8 py-14 sm:px-12 lg:order-first lg:w-[48%] lg:px-16 lg:py-24 xl:px-20">

        {/* thin vertical gold rule — desktop only */}
        <span className="absolute inset-y-0 right-0 hidden w-px lg:block"
          style={{ background: "linear-gradient(to bottom, transparent 15%, #b1842f55 40%, #b1842f55 60%, transparent 85%)" }}
        />

        {/* eyebrow */}
        <div className="mb-6 flex items-center gap-2.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-gold">
          <MapPin size={11} />
          <span>Beauty Salon · Union Metro, Dubai</span>
        </div>

        {/* headline */}
        <h1 className="font-display text-[2.6rem] font-light leading-[1.08] text-cream sm:text-5xl lg:text-[3.5rem] xl:text-[4rem]">
          {t.hero.title}
        </h1>

        {/* decorative gold rule */}
        <span className="mt-7 block h-px w-12 bg-gold" />

        {/* subtitle */}
        <p className="mt-6 max-w-md text-[0.95rem] leading-relaxed text-sand">
          {t.hero.subtitle}
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <ButtonLink href="/book" size="lg">
            {t.hero.cta}
          </ButtonLink>
          <Link
            href="/services"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gold transition-colors hover:text-gold-deep"
          >
            {t.hero.secondary} <ArrowRight size={14} />
          </Link>
        </div>

        {/* trust chips */}
        <ul className="mt-10 flex flex-wrap gap-x-5 gap-y-2 text-xs text-sand/80">
          <li className="flex items-center gap-1.5">
            <Clock size={12} className="text-gold" /> {t.common.openDaily}
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-gold/50" />
            Sterilised, single-use tools
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-gold/50" />
            Every hair type &amp; culture
          </li>
        </ul>

        {/* Instagram handle */}
        <a
          href={SITE.social.instagram}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 text-xs tracking-wide text-gold/70 transition-colors hover:text-gold"
        >
          {SITE.social.instagramHandle}
        </a>
      </div>

    </section>
  );
}
