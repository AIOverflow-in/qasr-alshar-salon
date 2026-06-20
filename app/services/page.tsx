import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { ServiceCard } from "@/components/ServiceCard";
import { Reveal } from "@/components/Reveal";
import { ButtonLink } from "@/components/ui/Button";
import { CATEGORIES } from "@/lib/services";
import { aed } from "@/lib/utils";
import { pageMeta, breadcrumbSchema } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = pageMeta({
  title: "Services & Prices",
  description:
    "Explore the full menu at Qasr Alshar Salon Dubai — braiding, weaving, hair, nails, facials, makeup, henna, lashes, waxing, threading & massage with transparent AED pricing.",
  path: "/services",
  keywords: ["salon services Dubai", "salon price list Dubai", "beauty salon Union Metro"],
});

export default function ServicesPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Services", path: "/services" },
        ])}
      />
      <PageHero
        eyebrow="Our Menu"
        title="Services & Prices"
        subtitle="A complete beauty experience under one golden roof — with honest, transparent pricing in AED."
        image="/gallery/hair.jpg"
        crumbs={[{ name: "Services", href: "/services" }]}
      />

      {/* category cards */}
      <section className="section-y">
        <div className="container-x">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((cat, i) => (
              <Reveal key={cat.slug} delay={i * 50}>
                <ServiceCard cat={cat} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* full price list */}
      <section className="section-y border-t border-ink-line bg-ink-soft">
        <div className="container-x">
          <h2 className="text-center font-display text-3xl text-cream md:text-4xl">
            Full Price List
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-2">
            {CATEGORIES.map((cat) => (
              <Reveal key={cat.slug}>
                <div className="surface rounded-2xl p-6">
                  <div className="mb-4 flex items-center justify-between border-b border-ink-line pb-3">
                    <h3 className="font-display text-2xl text-gold">{cat.name}</h3>
                    <Link
                      href={`/services/${cat.slug}`}
                      className="text-xs uppercase tracking-wider text-sand hover:text-gold"
                    >
                      Details →
                    </Link>
                  </div>
                  <ul className="divide-y divide-ink-line/60">
                    {cat.items.map((item) => (
                      <li
                        key={item.name}
                        className="flex items-baseline justify-between gap-4 py-2.5"
                      >
                        <span className="text-sand">{item.name}</span>
                        <span className="shrink-0 font-semibold text-cream">
                          {aed(item.price, item.plus)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>

          <div className="mt-12 text-center">
            <ButtonLink href="/book" size="lg">Book an Appointment</ButtonLink>
            <p className="mt-3 text-sm text-muted">
              Prices may vary by hair length & complexity. Ask us for a quick quote on WhatsApp.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
