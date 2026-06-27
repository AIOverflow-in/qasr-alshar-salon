import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { ButtonLink } from "@/components/ui/Button";
import { GalleryGrid } from "@/components/gallery/GalleryGrid";
import { SITE } from "@/lib/site";
import { pageMeta, breadcrumbSchema } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = pageMeta({
  title: "Gallery",
  description:
    "See the real work of Qasr Alshar Salon Dubai — 80+ braiding, knotless braids, henna, nail art, locs and more. Book your appointment online.",
  path: "/gallery",
});

const PHOTOS = [
  // ── Braiding & Hair ──────────────────────────────────────────────────────
  { src: "/work/hair/braiding-knotless-boho-curly-ends.jpg",    label: "Knotless Boho Braids",       category: "hair" },
  { src: "/work/hair/braiding-cornrows-geometric-crown.jpg",    label: "Geometric Crown Cornrows",   category: "hair" },
  { src: "/work/hair/braiding-locs-updo-gold-charms.jpg",       label: "Locs Updo with Gold Charms", category: "hair" },
  { src: "/work/hair/braiding-cornrow-updo-bun.jpg",            label: "Cornrow Updo Bun",           category: "hair" },
  { src: "/work/hair/braiding-knotless-box-gold-beads.jpg",     label: "Knotless Box with Gold Beads", category: "hair" },
  { src: "/work/hair/braiding-cornrows-swirl-pattern.jpg",      label: "Swirl Cornrows",             category: "hair" },
  { src: "/work/hair/braiding-cornrows-feedin-long-portrait.jpg", label: "Feed-In Cornrows",         category: "hair" },
  { src: "/work/hair/braiding-cornrows-updo-closeup.jpg",       label: "Cornrow Updo Close-Up",      category: "hair" },
  { src: "/work/hair/braiding-fulani-cornrow-box-braids-girl.jpg", label: "Fulani + Box Braids",     category: "hair" },
  { src: "/work/hair/braiding-locs-updo-twisted.jpg",           label: "Twisted Locs Updo",          category: "hair" },
  { src: "/work/hair/braiding-cornrow-updo-two-tone.jpg",       label: "Two-Tone Cornrow Updo",      category: "hair" },
  { src: "/work/hair/braiding-knotless-updo-bun.jpg",           label: "Knotless Updo Bun",          category: "hair" },
  { src: "/work/hair/braiding-swirl-cornrows-closeup.jpg",      label: "Swirl Cornrows Close-Up",    category: "hair" },
  { src: "/work/hair/braiding-cornrows-sleek-side.jpg",         label: "Sleek Side Cornrows",        category: "hair" },
  { src: "/work/hair/braiding-cornrows-updo-collage.jpg",       label: "Cornrow Updo Collage",       category: "hair" },
  { src: "/work/hair/braiding-cornrow-feedin-salon.jpg",        label: "Feed-In Cornrows in Salon",  category: "hair" },
  { src: "/work/hair/braiding-knotless-box-bun-shop.jpg",       label: "Box Braid Bun",              category: "hair" },
  { src: "/work/hair/braiding-cornrows-swirl-pattern-side.jpg", label: "Swirl Cornrows Side View",  category: "hair" },
  { src: "/work/hair/braiding-cornrow-updo-sleek-pink-bg.jpg",  label: "Sleek Cornrow Updo",         category: "hair" },
  { src: "/work/hair/braiding-cornrow-bun-collage-two-styles.jpg", label: "Two-Style Collage",       category: "hair" },
  { src: "/work/hair/braiding-knotless-box-kid-long-curly.jpg", label: "Knotless Box Long Curly",    category: "hair" },
  { src: "/work/hair/braiding-knotless-feedin-gold-cuffs.jpg",  label: "Knotless Feed-In Gold Cuffs",category: "hair" },
  { src: "/work/hair/braiding-cornrow-bun-brown-two-tone.jpg",  label: "Brown Two-Tone Cornrow Bun", category: "hair" },
  { src: "/work/hair/braiding-cornrow-bun-black-honey-side.jpg",label: "Black & Honey Cornrow Bun",  category: "hair" },
  { src: "/work/hair/braiding-swirl-cornrow-top-view.jpg",      label: "Swirl Cornrow Top View",     category: "hair" },
  { src: "/work/hair/braiding-swirl-geometric-cornrow-side-view.jpg", label: "Geometric Swirl Cornrows", category: "hair" },
  { src: "/work/hair/braiding-feedin-swirl-cornrow-long-back.jpg", label: "Swirl Feed-In Long Back",  category: "hair" },
  { src: "/work/hair/braiding-locs-updo-bun-gold-star-charms.jpg", label: "Locs Bun with Star Charms", category: "hair" },
  { src: "/work/hair/braiding-locs-twisted-updo-brown.jpg",     label: "Twisted Locs Updo Brown",    category: "hair" },
  { src: "/work/hair/braiding-knotless-boho-curly-bob-medium.jpg", label: "Knotless Boho Curly Bob", category: "hair" },
  { src: "/work/hair/braiding-feedin-cornrows-salon-client-front.jpg", label: "Salon Feed-In Cornrows Front", category: "hair" },
  { src: "/work/hair/braiding-cornrow-geometric-dome-full-head.jpg", label: "Geometric Dome Cornrows", category: "hair" },
  // ── Nails ────────────────────────────────────────────────────────────────
  { src: "/work/nails/nail-art-gold-chrome-french-tips.jpg",    label: "Gold Chrome French Tips",   category: "nails" },
  { src: "/work/nails/nail-art-leopard-print-stiletto.jpg",     label: "Leopard Print Stiletto",     category: "nails" },
  { src: "/work/nails/nail-art-red-aurora-stiletto.jpg",        label: "Red Aurora Stiletto",        category: "nails" },
  { src: "/work/nails/nail-art-pink-ombre-mani-pedi.jpg",       label: "Pink Ombré Mani & Pedi",    category: "nails" },
  { src: "/work/nails/nail-art-hot-pink-leopard-coffin.jpg",    label: "Hot Pink Leopard Coffin",    category: "nails" },
  { src: "/work/nails/nail-art-magenta-gold-mani-pedi.jpg",     label: "Magenta & Gold Mani-Pedi",   category: "nails" },
  { src: "/work/nails/nail-art-nude-leopard-tips-stiletto.jpg", label: "Nude Leopard Tips",          category: "nails" },
  { src: "/work/nails/nail-art-pink-glitter-french-tip.jpg",    label: "Pink Glitter French Tip",    category: "nails" },
  { src: "/work/nails/nail-art-red-glossy-coffin.jpg",          label: "Red Glossy Coffin",          category: "nails" },
  { src: "/work/nails/nail-art-black-glossy-square.jpg",        label: "Black Glossy Square",        category: "nails" },
  { src: "/work/nails/nail-art-ombre-blush-square.jpg",         label: "Ombré Blush Square",         category: "nails" },
  { src: "/work/nails/nail-art-french-tip-gold-heart-mani-pedi.jpg", label: "Gold Heart Mani-Pedi", category: "nails" },
  { src: "/work/nails/nail-art-deep-red-square-gel.jpg",        label: "Deep Red Square Gel",        category: "nails" },
  { src: "/work/nails/nail-art-yellow-french-tip-square.jpg",   label: "Yellow French Tip",          category: "nails" },
  { src: "/work/nails/nail-art-pink-french-tip-almond.jpg",     label: "Pink French Tip Almond",     category: "nails" },
  { src: "/work/nails/nail-art-red-ombre-almond.jpg",           label: "Red Ombré Almond",           category: "nails" },
  { src: "/work/nails/pedicure-french-tip-toes.jpg",            label: "French Tip Pedicure",        category: "nails" },
  { src: "/work/nails/nail-art-hot-pink-leopard-closeup.jpg",   label: "Hot Pink Leopard Close-Up",  category: "nails" },
  { src: "/work/nails/pedicure-french-tip-clean.jpg",           label: "Clean French Pedicure",      category: "nails" },
  { src: "/work/nails/nail-art-hot-pink-leopard-coffin-both-hands.jpg", label: "Hot Pink Leopard Both Hands", category: "nails" },
  { src: "/work/nails/pedicure-french-tip-white-both-feet.jpg", label: "White French Tip Both Feet",   category: "nails" },
  { src: "/work/nails/nail-art-burgundy-wine-square-short.jpg", label: "Burgundy Wine Square",         category: "nails" },
  { src: "/work/nails/nail-art-oxblood-maroon-square-short.jpg",label: "Oxblood Maroon Square",        category: "nails" },
  // ── Henna ────────────────────────────────────────────────────────────────
  { src: "/work/henna/henna-floral-swirl-both-hands.jpg",       label: "Floral Swirl Both Hands",    category: "henna" },
  { src: "/work/henna/henna-floral-arabesque-both-hands.jpg",   label: "Arabesque Both Hands",       category: "henna" },
  { src: "/work/henna/henna-floral-both-hands.jpg",             label: "Floral Henna Both Hands",    category: "henna" },
  { src: "/work/henna/henna-floral-back-of-hands-duo.jpg",      label: "Henna Duo — Fresh & Dried",  category: "henna" },
  { src: "/work/henna/henna-floral-back-of-hand.jpg",           label: "Traditional Floral Mehndi",  category: "henna" },
  { src: "/work/henna/henna-floral-hand-back.jpg",              label: "Intricate Hand Mehndi",      category: "henna" },
  // ── Salon Interior ───────────────────────────────────────────────────────
  { src: "/salon/salon-main.jpg",                               label: "The Salon Floor",            category: "salon" },
  { src: "/salon/salon-interior-full-floor-view.jpg",           label: "Full Salon View",            category: "salon" },
  { src: "/salon/salon-interior-full-floor-floral-ceiling.jpg", label: "Floral Ceiling Installation",category: "salon" },
  { src: "/salon/salon-shampoo-chairs-product-wall.jpg",        label: "Shampoo Lounge",             category: "salon" },
  { src: "/salon/salon-shampoo-backwash-chairs-product-shelving.jpg", label: "Backwash Stations",   category: "salon" },
  { src: "/salon/salon-styling-chairs-gold-mirrors.jpg",        label: "Styling Stations",           category: "salon" },
  { src: "/salon/salon-nail-station-gold-accents.jpg",          label: "Nail Station",               category: "salon" },
  { src: "/salon/salon-pedicure-stations-gold-arc.jpg",         label: "Pedicure Lounge",            category: "salon" },
  { src: "/salon/salon-makeup-station-director-chair.jpg",      label: "Makeup Studio",              category: "salon" },
  { src: "/salon/salon-treatment-room-facial-bed.jpg",          label: "Treatment Room",             category: "salon" },
  { src: "/salon/treatment-room-ivory-bed.jpg",                 label: "Facial Suite",               category: "salon" },
];

export default function GalleryPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Gallery", path: "/gallery" }])} />
      <PageHero
        eyebrow="Portfolio"
        title="Real Work, Real Clients"
        subtitle="Every style here was done at our salon in Dubai. Browse by category, then book your look."
        image="/salon/salon-interior-full-floor-floral-ceiling.jpg"
        crumbs={[{ name: "Gallery", href: "/gallery" }]}
      />

      <section className="section-y">
        <div className="container-x">
          <GalleryGrid photos={PHOTOS} />

          <div className="mt-14 flex flex-col items-center gap-4 text-center">
            <p className="text-sand/80">Follow us for daily fresh looks straight from the chair.</p>
            <div className="flex gap-3">
              <ButtonLink href={SITE.social.instagram} variant="outline">@qasr.alshar on Instagram</ButtonLink>
              <ButtonLink href="/book">Book Your Look</ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
