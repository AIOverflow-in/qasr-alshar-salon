import type { Metadata } from "next";
import Image from "next/image";
import { PageHero } from "@/components/PageHero";
import { ButtonLink } from "@/components/ui/Button";
import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getCategory } from "@/lib/services";
import { aed } from "@/lib/utils";
import { pageMeta, breadcrumbSchema, faqSchema } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = pageMeta({
  title: "Henna by Qasr — Bridal & Traditional Mehndi in Dubai",
  description:
    "Henna by Qasr — exquisite bridal, traditional, floral, western & festive mehndi in Dubai. Book your henna session at Qasr Alshar Salon near Union Metro.",
  path: "/henna",
  images: ["/gallery/henna-feature.jpg"],
  keywords: ["henna Dubai", "bridal henna Dubai", "mehndi artist Dubai", "henna near Union Metro"],
});

const STYLES = [
  { name: "Bridal", text: "Elaborate, intricate designs for your big day — hands and feet." },
  { name: "Traditional", text: "Classic motifs rich in cultural heritage and meaning." },
  { name: "Floral", text: "Soft, modern florals that flatter every hand." },
  { name: "Western", text: "Minimal, contemporary patterns with elegant negative space." },
  { name: "Festive", text: "Eid, parties and celebrations — radiant and quick." },
  { name: "Party", text: "Fun designs for guests, kids and group bookings." },
];

const FAQ = [
  { q: "How long does bridal henna take?", a: "Bridal henna can take 2–4 hours depending on the intricacy and coverage. We recommend booking in advance." },
  { q: "How long before my event should I get henna?", a: "Ideally 24–48 hours before, so the stain deepens to its richest colour." },
  { q: "Do you do home or group bookings?", a: "Yes — contact us on WhatsApp for bridal parties, Eid and group henna sessions." },
];

export default function HennaPage() {
  const henna = getCategory("henna")!;
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Henna", path: "/henna" }])} />
      <JsonLd data={faqSchema(FAQ)} />

      <PageHero
        eyebrow="Henna by Qasr"
        title="The Art of Henna"
        subtitle="Crafted with care and drawn with passion — to make you feel radiant on every special occasion."
        image="/gallery/henna-feature.jpg"
        crumbs={[{ name: "Henna", href: "/henna" }]}
      />

      <section className="section-y">
        <div className="container-x grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-ink-line">
              <Image src="/gallery/henna.jpg" alt="Henna design in Dubai" fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" />
            </div>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="font-display text-4xl text-cream">Enhance your natural beauty</h2>
            <p className="mt-5 text-lg leading-relaxed text-sand/85">
              Henna is more than decoration — it's a celebration. At Qasr Alshar, our
              artists blend timeless tradition with modern artistry to create mehndi
              that's uniquely yours, using natural, skin-friendly henna for a rich,
              long-lasting stain.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <ButtonLink href="/book">Book Your Henna Session</ButtonLink>
              <div className="flex items-center text-sand">
                <span className="text-muted">from&nbsp;</span>
                <span className="text-xl font-semibold text-gold">
                  {aed(Math.min(...henna.items.map((i) => i.price)))}
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section-y border-t border-ink-line bg-ink-soft">
        <div className="container-x">
          <SectionHeading eyebrow="Styles" title="Henna for every occasion" />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {STYLES.map((s, i) => (
              <Reveal key={s.name} delay={i * 60}>
                <div className="surface surface-hover h-full rounded-2xl p-6">
                  <h3 className="font-display text-2xl text-gold">{s.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section-y">
        <div className="container-x max-w-3xl">
          <SectionHeading eyebrow="FAQ" title="Henna questions, answered" />
          <div className="mt-10 space-y-4">
            {FAQ.map((f) => (
              <Reveal key={f.q}>
                <details className="surface group rounded-2xl p-6">
                  <summary className="flex cursor-pointer items-center justify-between font-display text-lg text-cream">
                    {f.q}
                    <span className="text-gold transition-transform group-open:rotate-45">＋</span>
                  </summary>
                  <p className="mt-3 text-sand/80">{f.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
