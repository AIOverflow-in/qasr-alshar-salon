import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { Reveal } from "@/components/Reveal";
import { JsonLd } from "@/components/JsonLd";
import { pageMeta, breadcrumbSchema } from "@/lib/seo";
import { TERMS, TERMS_UPDATED } from "@/lib/terms";

export const metadata: Metadata = pageMeta({
  title: "Terms & Conditions",
  description:
    "Qasr Alshar Salon's booking terms — payment, punctuality (15-minute grace), cancellations, home visits, and more.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Terms & Conditions", path: "/terms" }])} />
      <PageHero
        eyebrow="The Fine Print"
        title="Terms & Conditions"
        subtitle="Clear, fair terms so every visit runs smoothly."
        image="/salon/salon-facial.jpg"
        crumbs={[{ name: "Terms & Conditions", href: "/terms" }]}
      />

      <section className="section-y">
        <div className="container-x mx-auto max-w-3xl">
          <p className="mb-10 text-sm text-muted">Last updated: {TERMS_UPDATED}</p>

          <div className="space-y-10">
            {TERMS.map((s, i) => (
              <Reveal key={s.heading} delay={i < 4 ? i * 60 : 0}>
                <div>
                  <h2 className="flex items-baseline gap-3 font-display text-xl text-cream">
                    <span className="text-sm text-gold">{String(i + 1).padStart(2, "0")}</span>
                    {s.heading}
                  </h2>
                  <div className="mt-3 space-y-3 border-l border-ink-line pl-5">
                    {s.body.map((p, j) => (
                      <p key={j} className="text-sand/85 leading-relaxed">{p}</p>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <p className="mt-12 rounded-2xl border border-gold/25 bg-gold/5 p-5 text-sm text-sand/85">
            By booking with Qasr Alshar Salon you confirm you have read and agree to these terms. We're
            always happy to clarify anything — just call or WhatsApp us.
          </p>
        </div>
      </section>
    </>
  );
}
