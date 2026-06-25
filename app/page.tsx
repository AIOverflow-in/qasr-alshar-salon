import Image from "next/image";
import Link from "next/link";
import { HeartHandshake, Crown, Clock, MapPin, ArrowRight, ShieldCheck, Leaf } from "lucide-react";
import { Hero } from "@/components/home/Hero";
import { InstagramIcon, TikTokIcon } from "@/components/icons";
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
  { icon: Crown, title: "True Specialists", text: "Real expertise in Afro-textured hair — knotless braids, locs & sew-ins — plus henna, glam & nails." },
  { icon: ShieldCheck, title: "Hygiene First", text: "Sterilised, single-use tools and fresh disposables for every client. Natural henna only — never black/PPD." },
  { icon: HeartHandshake, title: "Every Hair, Every Culture", text: "A warm, multicultural salon where African, Arab and South-Asian beauty are all done expertly." },
  { icon: Clock, title: "Easy Booking", text: "Reserve your slot online in under a minute — open daily, 10 AM to 10 PM, near Union Metro." },
];

const TRUST = [
  { icon: ShieldCheck, label: "Sterilised & single-use tools" },
  { icon: Leaf, label: "Natural henna — no PPD / black henna" },
  { icon: HeartHandshake, label: "All hair types & textures welcome" },
  { icon: Clock, label: "Open daily · 10 AM – 10 PM" },
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
                  <div className="absolute inset-0 bg-black/10 transition-colors group-hover:bg-black/0" />
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

      {/* TRUST */}
      <section className="section-y">
        <div className="container-x">
          <SectionHeading
            eyebrow="Your Peace of Mind"
            title="Cared for, the right way"
            subtitle="The things that matter most when you trust us with your hair and skin."
          />
          <div className="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {TRUST.map((item, i) => (
              <Reveal key={item.label} delay={i * 60}>
                <div className="surface flex h-full flex-col items-center gap-3 rounded-2xl p-6 text-center">
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-gold/10 text-gold">
                    <item.icon size={22} />
                  </div>
                  <span className="text-sm leading-snug text-sand">{item.label}</span>
                </div>
              </Reveal>
            ))}
          </div>

          {/* honest social proof — links to the salon's real, public profiles */}
          <Reveal className="mt-12">
            <div className="surface flex flex-col items-center gap-5 rounded-3xl p-8 text-center md:flex-row md:justify-between md:text-start">
              <div>
                <h3 className="font-display text-2xl text-cream">See real looks, every day</h3>
                <p className="mt-2 max-w-xl text-sand/80">
                  Hundreds of fresh styles from our chair — braids, locs, henna, glam & more.
                  Follow along and message us for a quick quote.
                </p>
              </div>
              <div className="flex shrink-0 gap-3">
                <ButtonLink href={SITE.social.instagram}>
                  <InstagramIcon size={18} /> Instagram
                </ButtonLink>
                <ButtonLink href={SITE.social.tiktok} variant="outline">
                  <TikTokIcon size={18} /> TikTok
                </ButtonLink>
              </div>
            </div>
          </Reveal>
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
                src={`https://maps.google.com/maps?q=${SITE.address.lat},${SITE.address.lng}&z=18&output=embed`}
                className="h-[360px] w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* HOME SERVICE */}
      <section className="section-y border-t border-ink-line bg-ink-soft">
        <div className="container-x grid items-center gap-12 lg:grid-cols-2">
          <Reveal delay={120}>
            <div className="text-xs font-medium uppercase tracking-[0.3em] text-gold">At Your Door</div>
            <h2 className="mt-4 font-display text-4xl text-cream md:text-5xl">Home Beauty Service</h2>
            <p className="mt-5 text-lg leading-relaxed text-sand/80">
              Can&apos;t make it to the salon? Our Crown Artists come to you. Home service is available
              across Dubai — braiding, henna, makeup, nails and more, delivered professionally to your
              residence or hotel room.
            </p>
            <ul className="mt-6 grid grid-cols-2 gap-3 text-sm text-sand">
              {["Braiding & Locs", "Henna Artistry", "Full Glam Makeup", "Manicure & Nails", "Hair Styling", "Wedding Packages"].map((x) => (
                <li key={x} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-gold flex-shrink-0" /> {x}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted">Minimum order applies by area. Message us on WhatsApp for a quote and availability.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={`https://wa.me/${SITE.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent("Hi Qasr Alshar! I'd like to enquire about a home service. 💇🏽‍♀️")}`} target="_blank" rel="noopener noreferrer">
                Book via WhatsApp
              </ButtonLink>
              <ButtonLink href="/book" variant="outline">Book at the Salon</ButtonLink>
            </div>
          </Reveal>
          <Reveal>
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-ink-line">
              <Image
                src="/salon/salon-main.jpg"
                alt="Qasr Alshar home beauty service Dubai"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <div className="absolute bottom-0 left-0 p-6">
                <div className="rounded-2xl border border-white/20 bg-black/40 px-5 py-4 backdrop-blur-sm">
                  <div className="text-sm font-semibold text-white">Available across Dubai</div>
                  <div className="mt-0.5 text-xs text-white/70">Message us for your area + min. order</div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* OUR WORK — real client results */}
      <section className="section-y">
        <div className="container-x">
          <SectionHeading eyebrow="Our Work" title="Real results, real clients" subtitle="Every style shown was done at our salon in Dubai — braiding, nails, henna and more." />
          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[
              { src: "/work/hair/braiding-knotless-boho-curly-ends.jpg",  label: "Knotless Boho Braids" },
              { src: "/work/nails/nail-art-gold-chrome-french-tips.jpg",  label: "Gold Chrome Nails" },
              { src: "/work/henna/henna-floral-swirl-both-hands.jpg",     label: "Floral Henna" },
              { src: "/work/hair/braiding-cornrows-geometric-crown.jpg",  label: "Geometric Cornrows" },
              { src: "/work/nails/nail-art-leopard-print-stiletto.jpg",   label: "Leopard Stiletto Nails" },
              { src: "/work/henna/henna-floral-arabesque-both-hands.jpg", label: "Arabesque Mehndi" },
              { src: "/work/hair/braiding-locs-updo-gold-charms.jpg",     label: "Locs with Gold Charms" },
              { src: "/work/nails/nail-art-pink-ombre-mani-pedi.jpg",     label: "Pink Ombré Mani-Pedi" },
            ].map((shot, i) => (
              <Reveal key={shot.src} delay={i * 40}>
                <Link href="/gallery" className="group relative block aspect-square overflow-hidden rounded-2xl border border-ink-line">
                  <Image
                    src={shot.src}
                    alt={`${shot.label} at Qasr Alshar Salon Dubai`}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/20 opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="absolute bottom-0 left-0 right-0 translate-y-full p-3 transition-transform group-hover:translate-y-0">
                    <span className="block rounded-lg bg-black/60 px-3 py-1.5 text-center text-xs font-medium text-white backdrop-blur-sm">
                      {shot.label}
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
          <div className="mt-10 text-center">
            <ButtonLink href="/gallery" variant="outline">View Full Gallery — 60+ Looks</ButtonLink>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="bg-gold-gradient">
          <div className="container-x py-16 text-center text-espresso">
            <Reveal>
              <h2 className="font-display text-4xl md:text-5xl">{t.sections.ctaTitle}</h2>
              <p className="mt-3 text-lg text-espresso/80">{t.sections.ctaSubtitle}</p>
              <div className="mt-8">
                <Link
                  href="/book"
                  className="inline-flex items-center gap-2 rounded-full bg-espresso px-8 py-4 font-semibold text-gold transition-transform hover:scale-105"
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
