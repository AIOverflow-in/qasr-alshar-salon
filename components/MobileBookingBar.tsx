"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, MessageCircle, Phone } from "lucide-react";
import { SITE } from "@/lib/site";
import { whatsappLink } from "@/lib/utils";

/** Always-present quick actions on mobile — the heart of the mobile-first booking flow. */
export function MobileBookingBar() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin") || pathname.startsWith("/book")) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
      <div className="mx-3 mb-3 flex items-center gap-2 rounded-2xl border border-ink-line bg-ink/95 p-2 shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        <a
          href={`tel:${SITE.phones[0].value}`}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-ink-line text-gold"
          aria-label="Call salon"
        >
          <Phone size={20} />
        </a>
        <a
          href={whatsappLink(SITE.whatsapp, "Hi Qasr Alshar! I'd like to book an appointment.")}
          target="_blank"
          rel="noopener noreferrer"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-ink-line text-gold"
          aria-label="WhatsApp salon"
        >
          <MessageCircle size={20} />
        </a>
        <Link
          href="/book"
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gold-gradient font-semibold text-espresso"
        >
          <CalendarCheck size={20} />
          Book Now
        </Link>
      </div>
    </div>
  );
}
