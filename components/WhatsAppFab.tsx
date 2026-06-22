"use client";

import { usePathname } from "next/navigation";
import { SITE } from "@/lib/site";
import { whatsappLink } from "@/lib/utils";

/** Persistent floating WhatsApp button on every public page (per 21 Jun decision). */
export function WhatsAppFab() {
  const pathname = usePathname();
  // Hidden in the ERP/admin and on the booking flow (its own CTAs).
  if (pathname.startsWith("/erp") || pathname.startsWith("/admin") || pathname.startsWith("/book"))
    return null;

  const href = whatsappLink(
    SITE.whatsapp,
    "Hi Qasr Alshar! I'd like to book an appointment. 💇🏽‍♀️"
  );

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with Qasr Alshar on WhatsApp"
      className="group fixed right-4 bottom-24 z-50 flex items-center gap-2 lg:bottom-6"
    >
      <span className="pointer-events-none absolute right-full mr-2 hidden whitespace-nowrap rounded-full bg-[#211c14] px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 lg:block">
        Book on WhatsApp
      </span>
      <span className="grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_8px_24px_-6px_rgba(37,211,102,0.7)] ring-4 ring-[#25D366]/20 transition-transform hover:scale-105 active:scale-95">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden>
          <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.513 5.26l-.999 3.648 3.875-1.017zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
        </svg>
      </span>
    </a>
  );
}
