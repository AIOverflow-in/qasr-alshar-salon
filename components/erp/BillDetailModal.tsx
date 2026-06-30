"use client";

import Link from "next/link";
import { X, Printer, Pencil, Clock, MapPin, Users, Scissors, UserCheck, CreditCard } from "lucide-react";
import { aed, cn } from "@/lib/utils";
import type { SalesRow } from "@/components/erp/SalesTable";

const SOURCE_LABEL: Record<string, string> = { ONLINE: "🌐 Online", WALKIN: "🏪 In-store", PHONE: "☎ Phone", WHATSAPP: "WhatsApp" };
const PAY_LABEL: Record<string, string> = { CASH: "Cash", CARD: "Card", TRANSFER: "Transfer" };

export function BillDetailModal({ row, canEdit, onClose }: { row: SalesRow; canEdit: boolean; onClose: () => void }) {
  const ref = row.invoiceNo;
  const when = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(row.createdAt));

  const Row = ({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) => (
    <div className="flex gap-3 py-2">
      <span className="mt-0.5 shrink-0 text-gold">{icon}</span>
      <div className="min-w-0">
        <div className="text-[0.65rem] uppercase tracking-wider text-muted">{label}</div>
        <div className="text-sm text-cream">{children}</div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 py-10" onClick={onClose}>
      <div className="surface w-full max-w-lg rounded-2xl border border-ink-line p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-2xl text-cream">{row.client}</h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono text-muted">{ref}</span>
              <span className="rounded-full border border-ink-line px-2 py-0.5 text-[0.6rem] text-sand">{PAY_LABEL[row.payment] ?? row.payment}</span>
              {row.cashier && <span className="text-muted">rung up by {row.cashier}</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-cream"><X size={20} /></button>
        </div>

        {/* line items with per-line artist */}
        <div className="rounded-xl border border-ink-line/60 p-3">
          <div className="mb-1.5 text-[0.65rem] uppercase tracking-wider text-muted">Items ({row.lines.length})</div>
          <ul className="divide-y divide-ink-line/40">
            {row.lines.map((l, i) => (
              <li key={i} className="flex items-start justify-between gap-3 py-1.5 text-sm">
                <div className="min-w-0">
                  <span className="text-cream">{l.description}</span>
                  <span className="text-xs text-muted"> · {l.qty} × {aed(l.unitAED)}</span>
                  <div className="text-xs text-muted">{l.artists.length ? `by ${l.artists.join(", ")}` : l.kind === "PRODUCT" ? "Product" : "—"}</div>
                </div>
                <span className="shrink-0 tabular-nums text-gold">{aed(l.lineAED)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 space-y-0.5 border-t border-ink-line pt-2 text-sm">
            <div className="flex justify-between text-muted"><span>Subtotal</span><span className="tabular-nums">{aed(row.net)}</span></div>
            <div className="flex justify-between text-muted"><span>VAT</span><span className="tabular-nums">{aed(row.vat)}</span></div>
            <div className="flex justify-between font-semibold text-cream"><span>Total</span><span className="tabular-nums">{aed(row.total)}</span></div>
          </div>
        </div>

        {/* meta */}
        <div className="mt-2 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          <Row icon={<Users size={15} />} label="Artists involved">{row.artists.length ? row.artists.join(", ") : "—"}</Row>
          <Row icon={<CreditCard size={15} />} label="Payment">{PAY_LABEL[row.payment] ?? row.payment}</Row>
          <Row icon={<Clock size={15} />} label="Billed">{when}</Row>
          <Row icon={<UserCheck size={15} />} label="Rung up by">{row.cashier ?? "—"}</Row>
        </div>

        {/* booking details (when the bill came from a booking) */}
        {row.booking && (
          <div className="mt-2 rounded-xl border border-ink-line/60 p-3">
            <div className="mb-1.5 flex items-center gap-2 text-[0.65rem] uppercase tracking-wider text-muted"><Scissors size={12} /> From booking</div>
            <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              <Row icon={<Clock size={15} />} label="Scheduled">{row.booking.whenLabel}</Row>
              <Row icon={<MapPin size={15} />} label="Where">
                {row.booking.serviceMode === "HOME" ? <>Home service{row.booking.address ? <div className="text-xs text-muted">{row.booking.address}</div> : null}</> : "At the salon"}
              </Row>
            </div>
            <div className="text-xs text-muted">Source: {SOURCE_LABEL[row.booking.source] ?? row.booking.source}</div>
            {row.booking.customRequest && <div className="mt-1 text-xs italic text-sand">Request: {row.booking.customRequest}</div>}
            {row.booking.notes && <div className="text-xs italic text-muted">“{row.booking.notes}”</div>}
          </div>
        )}
        {row.notes && <div className="mt-2 text-xs italic text-muted">Bill note: “{row.notes}”</div>}

        {/* actions */}
        <div className="mt-5 flex flex-wrap gap-2 border-t border-ink-line pt-4">
          {canEdit && (
            <Link href={`/erp/pos?orderId=${row.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-ink-line px-3 py-1.5 text-xs text-sand hover:text-gold">
              <Pencil size={13} /> Edit bill
            </Link>
          )}
          <a href={`/api/erp/invoice/${row.invoiceNo}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-gold/40 px-3 py-1.5 text-xs text-gold hover:bg-gold/10">
            <Printer size={13} /> Invoice PDF
          </a>
        </div>
      </div>
    </div>
  );
}
