import type { Metadata } from "next";
import Image from "next/image";
import { MapPin, Phone, Clock, MessageCircle } from "lucide-react";
import { InstagramIcon } from "@/components/icons";
import { PageHero } from "@/components/PageHero";
import { ButtonLink } from "@/components/ui/Button";
import { Reveal } from "@/components/Reveal";
import { SITE } from "@/lib/site";
import { whatsappLink } from "@/lib/utils";
import { pageMeta, breadcrumbSchema } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = pageMeta({
  title: "Contact & Location",
  description:
    "Contact Qasr Alshar Salon in Dubai — Dalmok Series Building, Exit 2, Union Metro. Call, WhatsApp or book online. Open daily 10 AM – 10 PM.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Contact", path: "/contact" }])} />
      <PageHero
        eyebrow="Get in Touch"
        title="Contact & Location"
        subtitle="We'd love to welcome you. Call, message or book online — whatever's easiest."
        image="/salon/salon-facial.jpg"
        crumbs={[{ name: "Contact", href: "/contact" }]}
      />

      <section className="section-y">
        <div className="container-x grid gap-10 lg:grid-cols-2">
          <Reveal>
            <div className="space-y-6">
              <div className="surface rounded-2xl p-6">
                <div className="flex items-start gap-4">
                  <MapPin className="mt-1 shrink-0 text-gold" />
                  <div>
                    <h3 className="font-display text-xl text-cream">Address</h3>
                    <p className="mt-1 text-sand/85">{SITE.address.line1}</p>
                    <p className="text-sand/85">{SITE.address.city}, {SITE.address.country}</p>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${SITE.address.mapsQuery}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-sm text-gold hover:underline"
                    >
                      Get directions →
                    </a>
                  </div>
                </div>
              </div>

              <div className="surface rounded-2xl p-6">
                <div className="flex items-start gap-4">
                  <Phone className="mt-1 shrink-0 text-gold" />
                  <div>
                    <h3 className="font-display text-xl text-cream">Call Us</h3>
                    <ul className="mt-1 space-y-1">
                      {SITE.phones.map((p) => (
                        <li key={p.value}>
                          <a href={`tel:${p.value}`} className="text-sand/85 hover:text-gold">
                            {p.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="surface rounded-2xl p-6">
                <div className="flex items-start gap-4">
                  <Clock className="mt-1 shrink-0 text-gold" />
                  <div>
                    <h3 className="font-display text-xl text-cream">Opening Hours</h3>
                    <p className="mt-1 text-sand/85">{SITE.hours.note}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <ButtonLink href={whatsappLink(SITE.whatsapp, "Hi Qasr Alshar! I'd like to book an appointment.")}>
                  <MessageCircle size={18} /> WhatsApp
                </ButtonLink>
                <ButtonLink href={SITE.social.instagram} variant="outline">
                  <InstagramIcon size={18} /> Instagram
                </ButtonLink>
                <ButtonLink href="/book" variant="outline">Book Online</ButtonLink>
              </div>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="space-y-6">
              <div className="overflow-hidden rounded-3xl border border-ink-line">
                <iframe
                  title="Qasr Alshar Salon location"
                  src={`https://www.google.com/maps?q=${SITE.address.mapsQuery}&output=embed`}
                  className="h-[320px] w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="surface rounded-2xl p-4 text-center">
                  <div className="relative mx-auto aspect-square w-full max-w-[160px] overflow-hidden rounded-xl">
                    <Image src="/brand/instagram-qr.jpg" alt="Scan to follow Qasr Alshar on Instagram" fill className="object-contain" />
                  </div>
                  <p className="mt-2 text-xs text-muted">Scan for Instagram</p>
                </div>
                <div className="surface rounded-2xl p-4 text-center">
                  <div className="relative mx-auto aspect-square w-full max-w-[160px] overflow-hidden rounded-xl">
                    <Image src="/brand/tiktok-qr.jpg" alt="Scan to follow Qasr Alshar on TikTok" fill className="object-contain" />
                  </div>
                  <p className="mt-2 text-xs text-muted">Scan for TikTok</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
