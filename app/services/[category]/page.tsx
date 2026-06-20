import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { ButtonLink } from "@/components/ui/Button";
import { Reveal } from "@/components/Reveal";
import { CATEGORIES, getCategory } from "@/lib/services";
import { SITE } from "@/lib/site";
import { aed } from "@/lib/utils";
import { pageMeta, breadcrumbSchema } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.slug }));
}

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const cat = getCategory(category);
  if (!cat) return pageMeta({ title: "Service" });
  return pageMeta({
    title: `${cat.name} in Dubai`,
    description: cat.intro.slice(0, 155),
    path: `/services/${cat.slug}`,
    images: [cat.image],
    keywords: cat.keywords,
  });
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const cat = getCategory(category);
  if (!cat) notFound();

  const from = Math.min(...cat.items.map((i) => i.price));
  const others = CATEGORIES.filter((c) => c.slug !== cat.slug).slice(0, 4);

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${cat.name} — ${SITE.name}`,
    serviceType: cat.name,
    description: cat.intro,
    areaServed: { "@type": "City", name: "Dubai" },
    provider: { "@type": "HairSalon", name: SITE.name, "@id": `${SITE.url}/#salon` },
    offers: cat.items.map((i) => ({
      "@type": "Offer",
      name: i.name,
      price: i.price,
      priceCurrency: "AED",
    })),
  };

  return (
    <>
      <JsonLd data={serviceSchema} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Services", path: "/services" },
          { name: cat.name, path: `/services/${cat.slug}` },
        ])}
      />

      <PageHero
        eyebrow={`from ${aed(from)}`}
        title={`${cat.name} in Dubai`}
        subtitle={cat.tagline}
        image={cat.image}
        crumbs={[
          { name: "Services", href: "/services" },
          { name: cat.name, href: `/services/${cat.slug}` },
        ]}
      />

      <section className="section-y">
        <div className="container-x grid gap-12 lg:grid-cols-[1.4fr_1fr]">
          {/* intro + pricing */}
          <div>
            <Reveal>
              <p className="text-lg leading-relaxed text-sand/85">{cat.intro}</p>
            </Reveal>

            <Reveal className="mt-10">
              <div className="surface rounded-2xl p-6">
                <h2 className="mb-4 font-display text-2xl text-gold">
                  {cat.name} Price List
                </h2>
                <ul className="divide-y divide-ink-line/60">
                  {cat.items.map((item) => (
                    <li
                      key={item.name}
                      className="flex items-center justify-between gap-4 py-3"
                    >
                      <span className="text-sand">{item.name}</span>
                      <span className="font-semibold text-cream">
                        {aed(item.price, item.plus)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  <ButtonLink href={`/book?category=${cat.slug}`} className="w-full sm:w-auto">
                    Book {cat.name} <ArrowRight size={18} />
                  </ButtonLink>
                </div>
              </div>
            </Reveal>
          </div>

          {/* sidebar */}
          <aside className="space-y-6">
            <Reveal>
              <div className="surface rounded-2xl p-6">
                <h3 className="font-display text-xl text-cream">Why Qasr Alshar</h3>
                <ul className="mt-4 space-y-3 text-sm text-sand">
                  {["Experienced specialists", "Hygienic, premium products", "Walk-ins & online booking", "Open daily 10 AM – 10 PM"].map((x) => (
                    <li key={x} className="flex gap-2">
                      <CheckCircle2 size={18} className="shrink-0 text-gold" /> {x}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={80}>
              <div className="surface rounded-2xl p-6">
                <h3 className="font-display text-xl text-cream">More Services</h3>
                <ul className="mt-4 space-y-2">
                  {others.map((o) => (
                    <li key={o.slug}>
                      <Link
                        href={`/services/${o.slug}`}
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-sand transition-colors hover:bg-gold/10 hover:text-gold"
                      >
                        {o.name} <ArrowRight size={15} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </aside>
        </div>
      </section>
    </>
  );
}
