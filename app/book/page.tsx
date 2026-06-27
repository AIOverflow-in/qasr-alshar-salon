import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/services";
import { getI18n } from "@/lib/i18n/server";
import { BookingWizard } from "@/components/booking/BookingWizard";
import { Logo } from "@/components/Logo";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Book an Appointment",
  description:
    "Book your appointment at Qasr Alshar Salon Dubai online in under a minute. Choose your service, pick a time, and you're set.",
  path: "/book",
});

const CATEGORY_ORDER = CATEGORIES.map((c) => c.name);

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string; category?: string }>;
}) {
  const { service: serviceParam, category: categoryParam } = await searchParams;
  const { locale, t } = await getI18n();

  let services: { id: string; name: string; priceAED: number; durationMin: number; category: string; categorySlug: string }[];
  let stylists: { id: string; name: string; role: string; offDay: string | null }[];
  try {
    [services, stylists] = await Promise.all([
      prisma.service.findMany({
        where: { active: true },
        orderBy: { order: "asc" },
        select: { id: true, name: true, priceAED: true, durationMin: true, category: true, categorySlug: true },
      }),
      prisma.staff.findMany({
        where: { active: true },
        orderBy: { order: "asc" },
        select: { id: true, name: true, role: true, offDay: true },
      }),
    ]);
  } catch (e) {
    // Neon free-tier can briefly cold-start; show a friendly retry instead of a 500.
    console.error("[book] services unavailable (DB cold-start?):", e);
    return (
      <div className="grid min-h-svh place-items-center bg-ink px-6 text-center">
        <div className="max-w-md">
          <Logo />
          <h1 className="mt-6 font-display text-2xl text-cream">Just a moment…</h1>
          <p className="mt-2 text-sand/80">Our booking system is waking up. Please refresh in a few seconds — or message us on WhatsApp and we&apos;ll book you in right away.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/book" className="rounded-full bg-gold-gradient px-6 py-3 font-semibold text-espresso">Refresh</Link>
            <Link href="/" className="rounded-full border border-ink-line px-6 py-3 text-sand hover:text-gold">Home</Link>
          </div>
        </div>
      </div>
    );
  }

  // Resolve a deep-linked service (by id or slug) or category for pre-selection.
  const preselected =
    services.find((s) => s.id === serviceParam) ??
    (categoryParam
      ? services.find((s) => s.categorySlug === categoryParam)
      : undefined);
  const initialCategoryName = categoryParam
    ? CATEGORIES.find((c) => c.slug === categoryParam)?.name
    : undefined;

  return (
    <div className="min-h-svh bg-ink">
      <div className="container-x flex items-center justify-between py-5">
        <Link href="/" aria-label="Home"><Logo /></Link>
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-sand/80 hover:text-gold">
          <ArrowLeft size={16} /> Home
        </Link>
      </div>

      <div className="container-x pb-24 pt-4">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-display text-4xl text-cream md:text-5xl">{t.booking.title}</h1>
          <p className="mt-3 text-sand/80">{t.booking.subtitle}</p>
        </div>

        <BookingWizard
          locale={locale}
          dict={t.booking}
          services={services}
          stylists={stylists}
          categoryOrder={CATEGORY_ORDER}
          initialServiceId={serviceParam && preselected?.id === serviceParam ? preselected.id : undefined}
          initialCategory={initialCategoryName}
        />
      </div>
    </div>
  );
}
