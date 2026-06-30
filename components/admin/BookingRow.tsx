"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { setBookingStatus } from "@/lib/actions/admin";
import type { BookingStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { BookingDetailModal } from "@/components/erp/BookingDetailModal";

type ServiceOpt = { id: string; name: string; category: string; priceAED: number };
type BookingDetail = { items: { serviceId: string | null; name: string; price: number; duration: number }[]; staffPhone: string | null; enteredBy: string | null; marketer?: string | null };

const STATUSES: BookingStatus[] = ["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];
const color: Record<string, string> = {
  CONFIRMED: "text-gold",
  COMPLETED: "text-green-400",
  CANCELLED: "text-red-400",
  NO_SHOW: "text-muted",
};

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  ONLINE: { label: "🌐 Online", cls: "border-blue-400/40 bg-blue-400/10 text-blue-300" },
  WALKIN: { label: "🏪 In-store", cls: "border-gold/40 bg-gold/10 text-gold" },
  PHONE: { label: "☎ Phone", cls: "border-ink-line text-sand" },
  WHATSAPP: { label: "WhatsApp", cls: "border-green-500/40 bg-green-500/10 text-green-400" },
};

export function BookingRow({
  id,
  when,
  startISO,
  name,
  phone,
  email,
  service,
  price,
  notes,
  status,
  source,
  staffName,
  serviceMode,
  address,
  customRequest,
  orderId,
  invoiceNo,
  services = [],
  currentServiceIds = [],
  canEditServices = false,
  canEditBill = false,
  detail,
}: {
  id: string;
  when: string;
  startISO: string;
  name: string;
  phone: string;
  email: string;
  service: string;
  price: string;
  notes: string | null;
  status: BookingStatus;
  source?: string | null;
  staffName?: string | null;
  serviceMode?: string | null;
  address?: string | null;
  customRequest?: string | null;
  orderId?: string | null;
  invoiceNo?: string | null;
  services?: ServiceOpt[];
  currentServiceIds?: string[];
  canEditServices?: boolean;
  canEditBill?: boolean;
  detail?: BookingDetail;
}) {
  const [current, setCurrent] = useState<BookingStatus>(status);
  const [pending, start] = useTransition();
  const [showDetail, setShowDetail] = useState(false);

  function change(next: BookingStatus) {
    setCurrent(next);
    start(() => setBookingStatus(id, next));
  }

  return (
    <tr className={cn(pending && "opacity-60")}>
      <td className="p-4 text-gold">{when}</td>
      <td className="p-4">
        <div className="text-cream">{name}</div>
        <div className="text-xs text-muted">
          <a href={`tel:${phone}`} className="hover:text-gold">{phone}</a> ·{" "}
          <a href={`mailto:${email}`} className="hover:text-gold">{email}</a>
        </div>
        {notes && <div className="mt-1 text-xs italic text-muted">“{notes}”</div>}
      </td>
      <td className="p-4 text-sand">
        <div className="flex flex-wrap items-center gap-2">
          {service}
          {serviceMode === "HOME" && <span className="rounded-full border border-gold/40 px-2 py-0.5 text-[0.6rem] text-gold">🏠 Home</span>}
        </div>
        {staffName && <div className="mt-0.5 text-xs text-muted">{staffName}</div>}
        <button onClick={() => setShowDetail(true)} className="mt-1 text-xs text-gold hover:underline">View details</button>
        {showDetail && detail && (
          <BookingDetailModal
            onClose={() => setShowDetail(false)}
            services={services}
            b={{
              id, name, phone, email, whenLabel: when, startISO, status: current, source: source ?? "ONLINE",
              serviceMode, address, customRequest, notes, staffName: staffName ?? null,
              staffPhone: detail.staffPhone, enteredBy: detail.enteredBy, marketer: detail.marketer ?? null, items: detail.items,
              orderId: orderId ?? null, invoiceNo: invoiceNo ?? null, canEditServices, canEditBill, currentServiceIds,
            }}
          />
        )}
      </td>
      <td className="p-4">
        {(() => {
          const b = SOURCE_BADGE[source ?? "ONLINE"] ?? SOURCE_BADGE.ONLINE;
          return <span className={cn("inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[0.65rem]", b.cls)}>{b.label}</span>;
        })()}
      </td>
      <td className="p-4 text-cream">{price}</td>
      <td className="p-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <select
              value={current}
              onChange={(e) => change(e.target.value as BookingStatus)}
              className={cn(
                "rounded-lg border border-ink-line bg-ink-card px-2.5 py-1.5 text-xs outline-none focus:border-gold/60",
                color[current]
              )}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s} className="bg-ink text-cream">
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
            {orderId && invoiceNo ? (
              <span className="inline-flex items-center gap-1 rounded-lg border border-green-500/40 bg-green-500/10 px-2.5 py-1.5 text-xs text-green-400" title={`Billed — ${invoiceNo}`}>
                <Receipt size={13} /> Billed
              </span>
            ) : (current === "COMPLETED" || current === "CONFIRMED") && (
              <Link
                href={`/erp/pos?bookingId=${id}`}
                className="inline-flex items-center gap-1 rounded-lg border border-gold/40 px-2.5 py-1.5 text-xs text-gold hover:bg-gold/10"
                title="Generate bill for this booking"
              >
                <Receipt size={13} /> Bill
              </Link>
            )}
          </div>
          {orderId && invoiceNo && (
            <div className="flex items-center gap-3 pl-0.5 text-xs">
              <span className="text-muted">{invoiceNo}</span>
              {canEditBill && <Link href={`/erp/pos?orderId=${orderId}`} className="text-gold hover:underline">Edit bill</Link>}
              <a href={`/api/erp/invoice/${invoiceNo}`} target="_blank" rel="noopener noreferrer" className="text-sand hover:text-gold">PDF</a>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
