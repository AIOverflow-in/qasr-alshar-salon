import type { Metadata } from "next";
import Image from "next/image";
import { PageHero } from "@/components/PageHero";
import { ButtonLink } from "@/components/ui/Button";
import { Reveal } from "@/components/Reveal";
import { CATEGORIES } from "@/lib/services";
import { pageMeta, breadcrumbSchema } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = pageMeta({
  title: "Gallery",
  description:
    "See the work of Qasr Alshar Salon Dubai — braiding, henna, hair, nails, makeup and more. Get inspired, then book your appointment online.",
  path: "/gallery",
});

const SHOTS = [
  { src: "/gallery/knotless.jpg", label: "Knotless Braids" },
  { src: "/gallery/locs.jpg", label: "Locs & Microlocs" },
  { src: "/gallery/braiding.jpg", label: "Cornrows" },
  { src: "/gallery/natural.jpg", label: "Natural Hair" },
  { src: "/gallery/weaving.jpg", label: "Sew-ins & Wigs" },
  { src: "/gallery/henna-feature.jpg", label: "Bridal Henna" },
  { src: "/gallery/henna.jpg", label: "Henna Art" },
  { src: "/gallery/makeup.jpg", label: "Bridal Makeup" },
  { src: "/gallery/nails.jpg", label: "Nails" },
  { src: "/gallery/lashes.jpg", label: "Lashes" },
  { src: "/gallery/hair.jpg", label: "Hair & Styling" },
  { src: "/gallery/facial.jpg", label: "Facials" },
  { src: "/gallery/waxing.jpg", label: "Spa & Waxing" },
  { src: "/gallery/threading.jpg", label: "Threading" },
  { src: "/gallery/massage.jpg", label: "Massage" },
  { src: "/gallery/about.jpg", label: "Our Salon" },
];

export default function GalleryPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Gallery", path: "/gallery" }])} />
      <PageHero
        eyebrow="Gallery"
        title="The Styles We Create"
        subtitle="A look at the services we specialise in — from braids and locs to henna and bridal glam. For our latest real client looks, follow us on Instagram."
        image="/gallery/makeup.jpg"
        crumbs={[{ name: "Gallery", href: "/gallery" }]}
      />

      <section className="section-y">
        <div className="container-x">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {SHOTS.map((s, i) => (
              <Reveal
                key={s.src + i}
                delay={(i % 4) * 60}
                className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-ink-line"
              >
                <Image
                  src={s.src}
                  alt={`${s.label} at Qasr Alshar Salon, Dubai`}
                  fill
                  sizes="(max-width:768px) 50vw, 25vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-ink/85 via-ink/10 to-transparent p-4">
                  <span className="font-display text-base text-gold drop-shadow">{s.label}</span>
                </div>
              </Reveal>
            ))}
          </div>

          <div className="mt-14 flex flex-col items-center gap-4 text-center">
            <p className="text-sand/80">Follow us for daily inspiration & fresh styles.</p>
            <div className="flex gap-3">
              <ButtonLink href="https://instagram.com/qasr.alshar" variant="outline">Instagram</ButtonLink>
              <ButtonLink href="/book">Book Now</ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
