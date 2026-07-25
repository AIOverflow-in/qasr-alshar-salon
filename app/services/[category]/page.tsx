import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { ButtonLink } from "@/components/ui/Button";
import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { CATEGORIES, getCategory } from "@/lib/services";
import { SITE } from "@/lib/site";
import { aed } from "@/lib/utils";
import { pageMeta, breadcrumbSchema } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { getPublishedProducts } from "@/lib/shop";
import { RecommendedProducts } from "@/components/shop/RecommendedProducts";

// Keyed by category slug. Kept in sync with lib/services.ts slugs — a unit test
// (lib/services.test.ts) asserts every key here is a real category slug so a
// future rename can't silently blank a category's "Our Work" gallery.
const GALLERY_PHOTOS: Record<string, { src: string; label: string }[]> = {
  "cornrow-styles": [
    { src: "/work/hair/braiding-cornrows-01.jpg",                label: "Cornrow Updo" },
    { src: "/work/hair/braiding-cornrows-02.jpg",                label: "Cornrow Braids" },
    { src: "/work/hair/braiding-cornrows-03.jpg",                label: "Cornrow Style" },
    { src: "/work/hair/braiding-stitch-01.jpg",                  label: "Stitch Braids" },
    { src: "/work/hair/braiding-stitch-02.jpg",                  label: "Stitch Braids" },
    { src: "/work/hair/braiding-stitch-03.jpg",                  label: "Stitch Braids" },
    { src: "/work/hair/braiding-stitch-04.jpg",                  label: "Stitch Braids" },
    { src: "/work/hair/braiding-stitch-05.jpg",                  label: "Stitch Braids" },
  ],
  "braiding-styles": [
    { src: "/work/hair/braiding-knotless-01.jpg",                label: "Knotless Braids" },
    { src: "/work/hair/braiding-knotless-02.jpg",                label: "Knotless Braids" },
    { src: "/work/hair/braiding-knotless-03.jpg",                label: "Knotless Braids" },
    { src: "/work/hair/braiding-knotless-04.jpg",                label: "Knotless Braids" },
    { src: "/work/hair/braiding-knotless-05.jpg",                label: "Knotless Braids" },
    { src: "/work/hair/braiding-boho-01.jpg",                    label: "Boho Braids" },
    { src: "/work/hair/braiding-boho-02.jpg",                    label: "Boho Braids" },
    { src: "/work/hair/braiding-boho-03.jpg",                    label: "Boho Braids" },
    { src: "/work/hair/braiding-boho-04.jpg",                    label: "Boho Braids" },
    { src: "/work/hair/braiding-boho-05.jpg",                    label: "Boho Braids" },
    { src: "/work/hair/braiding-boho-06.jpg",                    label: "Boho Braids" },
    { src: "/work/hair/braiding-boho-07.jpg",                    label: "Boho Braids" },
    { src: "/work/hair/braiding-french-curl-01.jpg",             label: "French Curl Braids" },
    { src: "/work/hair/braiding-french-curl-02.jpg",             label: "French Curl Braids" },
    { src: "/work/hair/braiding-french-curl-03.jpg",             label: "French Curl Braids" },
    { src: "/work/hair/braiding-crochet-01.jpg",                 label: "Crochet Braids" },
    { src: "/work/hair/braiding-crochet-02.jpg",                 label: "Crochet Braids" },
    { src: "/work/hair/braiding-crochet-03.jpg",                 label: "Crochet Braids" },
  ],
  locks: [
    { src: "/work/hair/braiding-sisterlocks-01.jpg",             label: "Sisterlocks" },
    { src: "/work/hair/braiding-sisterlocks-02.jpg",             label: "Sisterlocks" },
    { src: "/work/hair/braiding-sisterlocks-03.jpg",             label: "Sisterlocks" },
    { src: "/work/hair/braiding-sisterlocks-04.jpg",             label: "Sisterlocks" },
    { src: "/work/hair/braiding-locs-crochet-01.jpg",            label: "Dreadlocks & Faux Locs" },
    { src: "/work/hair/braiding-locs-crochet-02.jpg",            label: "Dreadlocks & Faux Locs" },
    { src: "/work/hair/braiding-locs-crochet-03.jpg",            label: "Dreadlocks & Faux Locs" },
    { src: "/work/hair/braiding-locs-crochet-04.jpg",            label: "Dreadlocks & Faux Locs" },
    { src: "/work/hair/braiding-locs-crochet-05.jpg",            label: "Dreadlocks & Faux Locs" },
    { src: "/work/hair/braiding-locs-crochet-06.jpg",            label: "Dreadlocks & Faux Locs" },
  ],
  weaving: [
    { src: "/work/hair/wig-01.jpg",                              label: "Wig by Qasr" },
    { src: "/work/hair/wig-02.jpg",                              label: "Wig by Qasr" },
    { src: "/work/hair/wig-03.jpg",                              label: "Wig by Qasr" },
  ],
  haircut: [
    { src: "/work/hair/haircut-pixie-01.jpg",                    label: "Pixie Cut" },
    { src: "/work/hair/haircut-pixie-03.jpg",                    label: "Cut & Style" },
    { src: "/work/hair/haircut-pixie-04.jpg",                    label: "Cut & Style" },
    { src: "/work/hair/haircut-pixie-05.jpg",                    label: "Cut & Style" },
    { src: "/work/hair/haircut-pixie-06.jpg",                    label: "Cut & Style" },
    { src: "/work/hair/haircut-pixie-07.jpg",                    label: "Cut & Style" },
  ],
  hands: [
    { src: "/work/nails/nail-manicure-01.jpg",                   label: "Glossy Red Manicure" },
    { src: "/work/nails/nail-manicure-02.jpg",                   label: "Manicure" },
    { src: "/work/nails/nail-manicure-03.jpg",                   label: "Manicure" },
    { src: "/work/nails/nail-manicure-04.jpg",                   label: "Manicure" },
    { src: "/work/nails/nail-manicure-05.jpg",                   label: "Manicure" },
    { src: "/work/nails/nail-manicure-06.png",                   label: "Manicure" },
    { src: "/work/nails/nail-manicure-07.jpg",                   label: "Manicure" },
    { src: "/work/nails/nail-manicure-08.jpg",                   label: "Manicure" },
    { src: "/work/nails/nail-manicure-09.jpg",                   label: "Manicure" },
  ],
  podology: [
    { src: "/work/nails/pedicure-new-01.jpg",                    label: "French Pedicure" },
  ],
  henna: [
    { src: "/work/henna/henna-hand-01.jpg",                      label: "Bridal Henna" },
    { src: "/work/henna/henna-hand-02.jpg",                      label: "Bridal Henna" },
    { src: "/work/henna/henna-body-spine-01.jpg",                label: "Body Henna" },
    { src: "/work/henna/henna-body-spine-02.jpg",                label: "Body Henna" },
  ],
  "hair-styling": [
    { src: "/services/svc-hair-styling.jpg",                     label: "Hair Styling" },
    { src: "/services/svc-hair-styling-1.jpg",                   label: "Blow-Dry & Style" },
    { src: "/services/svc-hair-styling-2.jpg",                   label: "Salon Styling" },
    { src: "/services/svc-hair-styling-3.jpg",                   label: "Styled Finish" },
  ],
  "hairstyling-caucasian": [
    { src: "/services/svc-hairstyling-caucasian.jpg",           label: "Hair Styling" },
    { src: "/services/svc-hairstyling-caucasian-1.jpg",         label: "Blow-Dry" },
    { src: "/services/svc-hairstyling-caucasian-2.jpg",         label: "Sleek Finish" },
    { src: "/services/svc-hairstyling-caucasian-3.jpg",         label: "Soft Waves" },
  ],
  "hair-coloring": [
    { src: "/services/svc-hair-coloring.jpg",                    label: "Hair Colour" },
    { src: "/services/svc-hair-coloring-1.jpg",                  label: "Salon Colour" },
    { src: "/services/svc-hair-coloring-2.jpg",                  label: "Colour & Gloss" },
    { src: "/services/svc-hair-coloring-3.jpg",                  label: "Fresh Colour" },
  ],
  "hair-treatment": [
    { src: "/services/svc-hair-treatment.jpg",                   label: "Hair Treatment" },
    { src: "/services/svc-hair-treatment-1.jpg",                 label: "Nourishing Treatment" },
    { src: "/services/svc-hair-treatment-2.jpg",                 label: "Smoothing Treatment" },
    { src: "/services/svc-hair-treatment-3.jpg",                 label: "Repair Treatment" },
  ],
  facials: [
    { src: "/services/svc-hydrafacial.jpg",                      label: "14-Step HydraFacial" },
    { src: "/services/svc-facial.jpg",                           label: "Facial" },
    { src: "/services/svc-facial-1.jpg",                         label: "Glow Facial" },
    { src: "/services/svc-facial-2.jpg",                         label: "Hydrating Facial" },
    { src: "/services/svc-facial-3.jpg",                         label: "Radiance Facial" },
  ],
  "qasr-glam": [
    { src: "/services/svc-qasr-glam.jpg",                        label: "Qasr Glam" },
    { src: "/services/svc-qasr-glam-1.jpg",                      label: "Bridal Glam" },
    { src: "/services/svc-qasr-glam-2.jpg",                      label: "Soft Glam" },
    { src: "/services/svc-qasr-glam-3.jpg",                      label: "Evening Glam" },
  ],
  "face-waxing": [
    { src: "/services/svc-face-waxing.jpg",                      label: "Brow Threading" },
    { src: "/services/svc-face-waxing-1.jpg",                    label: "Facial Waxing" },
  ],
  "body-waxing": [
    { src: "/services/svc-body-waxing.jpg",                      label: "Leg Waxing" },
    { src: "/services/svc-body-waxing-1.jpg",                    label: "Arm Waxing" },
  ],
  lashes: [
    { src: "/services/svc-lashes.jpg",                           label: "Lash Extensions" },
    { src: "/services/svc-lashes-1.jpg",                         label: "Volume Lashes" },
  ],
  massage: [
    { src: "/services/svc-massage.jpg",                          label: "Relaxing Massage" },
    { src: "/services/svc-massage-1.jpg",                        label: "Spa Massage" },
  ],
};

// Service galleries that read better split into labelled sub-sections
// (grouped by each photo's label) rather than one flat grid.
const GROUPED_GALLERY = new Set(["braiding-styles", "locks"]);

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
  const galleryPhotos = GALLERY_PHOTOS[cat.slug] ?? [];
  // Deep-link the "View Full Gallery" button to this service's tab so it opens
  // filtered (e.g. cornrows only), not the whole mixed gallery.
  const galleryTab = ({
    "cornrow-styles": "cornrows", "braiding-styles": "braids", locks: "locs",
    hands: "nails", podology: "nails", henna: "henna",
  } as Record<string, string>)[cat.slug];
  // Split the "Our Work" grid into labelled sub-sections for grouped services
  // (e.g. Braids → Knotless/Boho/…; Locs → Sisterlocks/Dreadlocks & Faux Locs).
  const galleryGroups = GROUPED_GALLERY.has(cat.slug)
    ? Array.from(new Set(galleryPhotos.map((p) => p.label))).map((title) => ({
        title: title as string | null,
        photos: galleryPhotos.filter((p) => p.label === title),
      }))
    : [{ title: null as string | null, photos: galleryPhotos }];
  // Take-home aftercare recommendations (converts a service visit into a shop sale).
  const recommended = (await getPublishedProducts()).slice(0, 4);

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

      {galleryPhotos.length > 0 && (
        <section className="section-y border-t border-ink-line bg-ink-soft">
          <div className="container-x">
            <SectionHeading
              eyebrow="Our Work"
              title={`Real ${cat.name} at Qasr Alshar`}
              subtitle="Every photo taken at our salon in Dubai. Book your look today."
            />
            {galleryGroups.map((grp, gi) => (
              <div key={grp.title ?? "all"} className={gi === 0 ? "mt-10" : "mt-12"}>
                {grp.title && (
                  <h3 className="mb-4 font-display text-xl text-gold">{grp.title}</h3>
                )}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {grp.photos.map((p, i) => (
                    <Reveal key={p.src} delay={(i % 4) * 50}>
                      <div className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-ink-line">
                        <Image
                          src={p.src}
                          alt={`${p.label} at Qasr Alshar Salon, Dubai`}
                          fill
                          sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 25vw"
                          className="object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-transparent to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                          <span className="font-display text-sm text-white drop-shadow">{p.label}</span>
                        </div>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </div>
            ))}
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ButtonLink href={`/book?category=${cat.slug}`}>Book Now <ArrowRight size={18} /></ButtonLink>
              <ButtonLink href={galleryTab ? `/gallery?cat=${galleryTab}` : "/gallery"} variant="outline">View Full Gallery</ButtonLink>
            </div>
          </div>
        </section>
      )}

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
                      className="flex items-start justify-between gap-4 py-3"
                    >
                      <span className="text-sand">
                        {item.name}
                        {item.note ? (
                          <span className="mt-0.5 block text-xs text-muted">
                            {item.note}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 font-semibold text-cream">
                        {aed(item.price, item.plus)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-muted">
                  Prices are inclusive of 5% VAT.
                </p>
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

      <RecommendedProducts products={recommended} />
    </>
  );
}
