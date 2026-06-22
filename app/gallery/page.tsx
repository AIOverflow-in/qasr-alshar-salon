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

// Real photos of the Qasr Alshar salon
const SHOTS = [
  { src: "/salon/salon-main.jpg", label: "The Salon" },
  { src: "/salon/salon-styling.jpg", label: "Styling Studio" },
  { src: "/salon/salon-nailbar.jpg", label: "Nail Bar" },
  { src: "/salon/salon-nails.jpg", label: "Nail Studio" },
  { src: "/salon/salon-facial.jpg", label: "Facial Suite" },
  { src: "/salon/salon-makeup.jpg", label: "Makeup Studio" },
  { src: "/salon/salon-pedicure.jpg", label: "Pedicure Lounge" },
  { src: "/salon/salon-pedicure-2.jpg", label: "Relax & Unwind" },
  { src: "/salon/salon-pedicure-stations.jpg", label: "Pedicure Stations" },
];

export default function GalleryPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Gallery", path: "/gallery" }])} />
      <PageHero
        eyebrow="Gallery"
        title="The Styles We Create"
        subtitle="A look at the services we specialise in — from braids and locs to henna and bridal glam. For our latest real client looks, follow us on Instagram."
        image="/salon/salon-makeup.jpg"
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
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/80 via-black/15 to-transparent p-4">
                  <span className="font-display text-base text-white drop-shadow">{s.label}</span>
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
