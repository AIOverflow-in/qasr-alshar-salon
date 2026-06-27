import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { ButtonLink } from "@/components/ui/Button";
import { Reveal } from "@/components/Reveal";
import { PACKAGES } from "@/lib/services";
import { SITE } from "@/lib/site";
import { aed, whatsappLink } from "@/lib/utils";
import { pageMeta, breadcrumbSchema } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = pageMeta({
  title: "Value Beauty Packages",
  description:
    "Value beauty packages at Qasr Alshar Salon Dubai — combine braids, lashes, waxing, gel polish and more at bundled prices. Great value, beautifully done.",
  path: "/packages",
  keywords: ["salon packages Dubai", "beauty package Dubai", "affordable salon Dubai", "salon offers Union Metro"],
});

export default function PackagesPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Packages", path: "/packages" }])} />
      <PageHero
        eyebrow="Save More"
        title="Value Beauty Packages"
        subtitle="Combine your favourite services into one bundle and save — beautifully done, every time."
        image="/salon/salon-main.jpg"
        crumbs={[{ name: "Packages", href: "/packages" }]}
      />

      <section className="section-y">
        <div className="container-x">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PACKAGES.map((p, i) => (
              <Reveal key={p.name} delay={i * 50}>
                <div className="surface surface-hover flex h-full flex-col rounded-2xl p-6">
                  <p className="flex-1 font-display text-lg leading-snug text-cream">
                    {p.name}
                  </p>
                  <div className="mt-5 flex items-center justify-between">
                    <span className="text-2xl font-semibold text-gold">
                      {aed(p.price, p.plus)}
                    </span>
                    <ButtonLink href="/book" size="sm">Book</ButtonLink>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-14">
            <div className="surface rounded-3xl p-8 text-center">
              <h2 className="font-display text-3xl text-cream">Need a custom package?</h2>
              <p className="mx-auto mt-3 max-w-xl text-sand/80">
                Message us on WhatsApp and we'll tailor a beauty bundle to suit you and your schedule.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <ButtonLink
                  href={whatsappLink(SITE.whatsapp, "Hi Qasr Alshar! I'd like a custom package quote.")}
                >
                  WhatsApp Us
                </ButtonLink>
                <ButtonLink href="/book" variant="outline">Book Online</ButtonLink>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
