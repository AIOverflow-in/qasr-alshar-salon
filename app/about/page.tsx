import type { Metadata } from "next";
import Image from "next/image";
import { PageHero } from "@/components/PageHero";
import { ButtonLink } from "@/components/ui/Button";
import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SITE } from "@/lib/site";
import { pageMeta, breadcrumbSchema } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = pageMeta({
  title: "About Us",
  description:
    "Qasr Alshar Salon — Dubai's crown of beauty near Union Metro. A warm, multicultural salon for braiding, hair, henna, nails, makeup and more.",
  path: "/about",
});

const STATS = [
  { n: "40+", l: "Beauty Services" },
  { n: "11", l: "Service Categories" },
  { n: "7", l: "Days a Week" },
  { n: "10–10", l: "Open Late, Daily" },
];

export default function AboutPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "About", path: "/about" }])} />
      <PageHero
        eyebrow="Our Story"
        title="Dubai's Crown of Beauty"
        subtitle="Where every guest leaves feeling like royalty."
        image="/salon/salon-styling.jpg"
        crumbs={[{ name: "About", href: "/about" }]}
      />

      <section className="section-y">
        <div className="container-x grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-ink-line">
              <Image src="/salon/salon-main.jpg" alt="Inside Qasr Alshar Salon Dubai" fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" />
            </div>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="font-display text-4xl text-cream">More than a salon</h2>
            <div className="mt-5 space-y-4 text-lg leading-relaxed text-sand/85">
              <p>
                Qasr Alshar — "Palace of Beauty" — was born from a love for craft and
                community. Tucked beside Union Metro in the heart of Dubai, we bring
                together specialists in braiding, weaving, henna, hair, nails and glam
                under one elegant, golden roof.
              </p>
              <p>
                Our clients come from every corner of the world, and so does our
                expertise. Whether it's flawless knotless braids, a natural sew-in,
                radiant bridal makeup or intricate mehndi, we treat every appointment
                as a celebration of you.
              </p>
            </div>
            <div className="mt-8">
              <ButtonLink href="/book">Book Your Visit</ButtonLink>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section-y border-t border-ink-line bg-ink-soft">
        <div className="container-x">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {STATS.map((s, i) => (
              <Reveal key={s.l} delay={i * 60} className="text-center">
                <div className="font-display text-4xl text-gold-gradient md:text-5xl">{s.n}</div>
                <div className="mt-2 text-sm uppercase tracking-wider text-muted">{s.l}</div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* TEAM */}
      <section className="section-y">
        <div className="container-x">
          <SectionHeading
            eyebrow="Our Team"
            title="Meet Our Crown Artists"
            subtitle="Specialists in braiding, hair, nails, henna, makeup and more — every one trained to make you feel like royalty."
          />
          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {[
              "/staff/staff-portrait-qasr-alshar-uniform-smiling.jpg",
              "/staff/staff-portrait-red-locs-updo.jpg",
              "/staff/staff-portrait-navy-wavy-hair.jpg",
              "/staff/staff-portrait-red-arms-crossed-2.jpg",
              "/staff/staff-portrait-male-navy-smiling.jpg",
              "/staff/staff-portrait-red-wavy-bob.jpg",
              "/staff/staff-portrait-navy-arms-crossed.jpg",
              "/staff/staff-portrait-male-red-smiling.jpg",
              "/staff/staff-portrait-red-polo-updo.jpg",
              "/staff/staff-portrait-red-polo-arms-crossed.jpg",
              "/staff/staff-portrait-locs-updo-red-uniform.jpg",
              "/staff/staff-portrait-curly-bob-uniform.jpg",
              "/staff/staff-portrait-red-gold-bracelet.jpg",
              "/staff/staff-portrait-red-polo-smiling.jpg",
              "/staff/staff-portrait-red-uniform-arms-crossed.jpg",
              "/staff/staff-portrait-navy-natural-hair.jpg",
              "/staff/staff-portrait-male-stylist-branded-polo.jpg",
              "/staff/staff-portrait-lab-coat-pectiv.jpg",
              "/staff/staff-portrait-holding-pectiv-product.jpg",
              "/staff/staff-portrait-male-red-uniform.jpg",
              "/staff/staff-portrait-qasr-alshar-uniform.jpg",
            ].map((src, i) => (
              <Reveal key={src} delay={(i % 6) * 50}>
                <div className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-ink-line bg-ink-soft">
                  <Image
                    src={src}
                    alt="Qasr Alshar Crown Artist"
                    fill
                    sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 16vw"
                    className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              </Reveal>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-sand/60">Select your preferred Crown Artist when you book online.</p>
          <div className="mt-4 text-center">
            <ButtonLink href="/book">Book With Your Favourite Artist</ButtonLink>
          </div>
        </div>
      </section>

      <section className="section-y border-t border-ink-line">
        <div className="container-x max-w-3xl text-center">
          <SectionHeading
            eyebrow="Visit Us"
            title="Find Qasr Alshar"
            subtitle={`${SITE.address.line1}, ${SITE.address.city}`}
          />
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/contact">Contact & Directions</ButtonLink>
            <ButtonLink href="/services" variant="outline">View Services</ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
