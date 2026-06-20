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

export default async function BookPage() {
  const { locale, t } = await getI18n();
  const services = await prisma.service.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
    select: {
      id: true,
      name: true,
      priceAED: true,
      durationMin: true,
      category: true,
      categorySlug: true,
    },
  });

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
          categoryOrder={CATEGORY_ORDER}
        />
      </div>
    </div>
  );
}
