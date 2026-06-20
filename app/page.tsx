import Image from "next/image";
import Link from "next/link";
import { Sparkles, HeartHandshake, Crown, Clock, MapPin, ArrowRight, Quote } from "lucide-react";
import { Hero } from "@/components/home/Hero";
import { ServiceCard } from "@/components/ServiceCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ButtonLink } from "@/components/ui/Button";
import { Reveal } from "@/components/Reveal";
import { CATEGORIES } from "@/lib/services";
import { SITE } from "@/lib/site";
import { getI18n } from "@/lib/i18n/server";
import { prisma } from "@/lib/prisma";
import { breadcrumbSchema } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

export const revalidate = 3600;

const WHY = [
  { icon: Crown, title: "Master Artists", text: "Specialists in braiding, weaving, henna & glam — years of craft in every detail." },
  { icon: Sparkles, title: "Premium Products", text: "Quality products and hygienic, well-loved tools for results that last." },
  { icon: HeartHandshake, title: "For Everyone", text: "A warm, multicultural salon serving every hair type and beauty need in Dubai." },
  { icon: Clock, title: "Easy Booking", text: "Reserve your slot online in under a minute — open daily, 10 AM to 10 PM." },
];

const TESTIMONIALS = [
  { name: "Amara O.", text: "Best knotless braids I've had in Dubai — neat, gentle and lasted weeks. The team is so welcoming!", service: "Knotless Braids" },
  { name: "Fatima A.", text: "My bridal henna was absolutely stunning. Every guest asked who did it. Thank you Qasr Alshar!", service: "Bridal Henna" },
  { name: "Joy M.", text: "Sew-in looked completely natural and the salon is gorgeous. My new go-to for hair and nails.", service: "Weave & Nails" },
];

export default async function HomePage() {
  const { t } = await getI18n();

  const posts = await prisma.blogPost
    .findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: 3,
    })
    .catch(() => []);

  const featured = ["braiding", "henna", "hair", "nails", "makeup", "weaving"]
    .map((s) => CATEGORIES.find((c) => c.slug === s)!)
    .filter(Boolean);

  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }])} />
      <Hero t={t} />

      {/* SERVICES */}
      <section className="section-y" id="services">
        <div className="container-x">
          <SectionHeading
            eyebrow={t.common.ourServices}
            title={t.sections.servicesTitle}
            subtitle={t.sections.servicesSubtitle}
          />
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((cat, i) => (
              <Reveal key={cat.slug} delay={i * 70}>
                <ServiceCard cat={cat} />
              </Reveal>
            ))}
          </div>
          <div className="mt-12 text-center">
            <ButtonLink href="/services" variant="outline" size="lg">
              {t.common.viewAll} {t.nav.services} <ArrowRight size={18} />
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* HENNA FEATURE */}
      <section className="relative overflow-hidden border-y border-ink-line bg-ink-soft section-y">
        <div className="container-x grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-ink-line">
              <Image
                src="/gallery/henna-feature.jpg"
                alt="Bridal henna artistry at Qasr Alshar Salon Dubai"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="text-xs font-medium uppercase tracking-[0.3em] text-gold">
              {t.sections.hennaTitle}
            </div>
            <h2 className="mt-4 font-display text-4xl text-cream md:text-5xl">
              The timeless art of henna
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-sand/80">
              From bridal and traditional to floral, western and festive designs —
              our henna artists craft intricate mehndi that makes you feel radiant
              on every special occasion in Dubai.
            </p>
            <ul className="mt-6 grid grid-cols-2 gap-3 text-sm text-sand">
              {["Bridal", "Traditional", "Floral", "Western", "Festive", "Party"].map((x) => (
                <li key={x} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-gold" /> {x}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <ButtonLink href="/henna">Discover Henna by Qasr</ButtonLink>
            </div>
          </Reveal>
        </div>
      </section>

      {/* WHY */}
      <section className="section-y">
        <div className="container-x">
          <SectionHeading eyebrow="Why Choose Us" title={t.sections.whyTitle} />
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {WHY.map((w, i) => (
              <Reveal key={w.title} delay={i * 70}>
                <div className="surface surface-hover h-full rounded-2xl p-7">
                  <div className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-gold/10 text-gold">
                    <w.icon size={24} />
                  </div>
                  <h3 className="font-display text-xl text-cream">{w.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{w.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* GALLERY PREVIEW */}
      <section className="section-y border-t border-ink-line bg-ink-soft">
        <div className="container-x">
          <SectionHeading eyebrow="Portfolio" title={t.sections.galleryTitle} />
          <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-4">
            {CATEGORIES.slice(0, 8).map((c, i) => (
              <Reveal key={c.slug} delay={i * 50}>
                <Link
                  href="/gallery"
                  className="group relative block aspect-square overflow-hidden rounded-xl border border-ink-line"
                >
                  <Image
                    src={c.image}
                    alt={`${c.name} Dubai`}
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-ink/30 transition-colors group-hover:bg-ink/10" />
                </Link>
              </Reveal>
            ))}
          </div>
          <div className="mt-10 text-center">
            <ButtonLink href="/gallery" variant="outline">
              {t.common.viewAll} {t.nav.gallery}
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="section-y">
        <div className="container-x">
          <SectionHeading eyebrow="Testimonials" title={t.sections.testimonialsTitle} />
          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {TESTIMONIALS.map((r, i) => (
              <Reveal key={r.name} delay={i * 80}>
                <figure className="surface h-full rounded-2xl p-7">
                  <Quote className="text-gold/40" size={32} />
                  <blockquote className="mt-4 text-sand/90 leading-relaxed">
                    “{r.text}”
                  </blockquote>
                  <figcaption className="mt-6 flex items-center justify-between">
                    <span className="font-display text-lg text-cream">{r.name}</span>
                    <span className="text-xs uppercase tracking-wider text-gold">
                      {r.service}
                    </span>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* BLOG TEASER */}
      {posts.length > 0 && (
        <section className="section-y border-t border-ink-line bg-ink-soft">
          <div className="container-x">
            <SectionHeading eyebrow="Journal" title={t.sections.blogTitle} />
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {posts.map((p, i) => (
                <Reveal key={p.id} delay={i * 70}>
                  <Link
                    href={`/blog/${p.slug}`}
                    className="surface surface-hover group block h-full overflow-hidden rounded-2xl"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <Image
                        src={p.heroImage || "/gallery/hero.jpg"}
                        alt={p.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    </div>
                    <div className="p-6">
                      <span className="text-xs uppercase tracking-wider text-gold">
                        {p.category}
                      </span>
                      <h3 className="mt-2 font-display text-xl leading-snug text-cream group-hover:text-gold">
                        {p.title}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-sm text-muted">{p.excerpt}</p>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* LOCATION */}
      <section className="section-y">
        <div className="container-x grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <SectionHeading
              eyebrow="Find Us"
              title={t.sections.locationTitle}
              align="start"
            />
            <ul className="mt-8 space-y-5 text-sand">
              <li className="flex gap-4">
                <MapPin className="mt-1 shrink-0 text-gold" size={20} />
                <div>
                  <div className="font-medium text-cream">{SITE.address.line1}</div>
                  <div className="text-muted">
                    {SITE.address.city}, {SITE.address.country}
                  </div>
                </div>
              </li>
              <li className="flex gap-4">
                <Clock className="mt-1 shrink-0 text-gold" size={20} />
                <div className="text-cream">{t.common.openDaily}</div>
              </li>
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/book">{t.common.bookAppointment}</ButtonLink>
              <ButtonLink
                href={`https://www.google.com/maps/search/?api=1&query=${SITE.address.mapsQuery}`}
                variant="outline"
              >
                {t.common.getDirections}
              </ButtonLink>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="overflow-hidden rounded-3xl border border-ink-line">
              <iframe
                title="Qasr Alshar Salon location"
                src={`https://www.google.com/maps?q=${SITE.address.mapsQuery}&output=embed`}
                className="h-[360px] w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="bg-gold-gradient">
          <div className="container-x py-16 text-center text-ink">
            <Reveal>
              <h2 className="font-display text-4xl md:text-5xl">{t.sections.ctaTitle}</h2>
              <p className="mt-3 text-lg text-ink/80">{t.sections.ctaSubtitle}</p>
              <div className="mt-8">
                <Link
                  href="/book"
                  className="inline-flex items-center gap-2 rounded-full bg-ink px-8 py-4 font-semibold text-gold transition-transform hover:scale-105"
                >
                  {t.common.bookNow} <ArrowRight size={18} />
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}
