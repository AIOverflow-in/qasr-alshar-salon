"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, MessageCircle, Printer, Receipt, Clock, MapPin, Scissors, UserCheck, Megaphone, Wallet } from "lucide-react";
import { whatsappLink, aed, cn } from "@/lib/utils";
import { salonToClientMessage, artistReminderMessage } from "@/lib/booking-format";
import { EditBookingServices } from "@/components/erp/EditBookingServices";

type Item = { serviceId?: string | null; name: string; price: number; duration: number; staffId?: string | null };
type ServiceOpt = { id: string; name: string; category: string; priceAED: number };

const SOURCE_LABEL: Record<string, string> = { ONLINE: "🌐 Online", WALKIN: "🏪 In-store", PHONE: "☎ Phone", WHATSAPP: "WhatsApp" };
const STATUS_CLR: Record<string, string> = { CONFIRMED: "text-gold", COMPLETED: "text-green-400", CANCELLED: "text-red-600", NO_SHOW: "text-muted" };

export function BookingDetailModal({
  onClose,
  b,
  services,
  staff = [],
}: {
  onClose: () => void;
  b: {
    id: string; name: string; phone: string; email: string; whenLabel: string; startISO: string;
    status: string; source: string; serviceMode?: string | null; address?: string | null;
    customRequest?: string | null; notes: string | null; staffId?: string | null; staffName: string | null; staffPhone: string | null;
    enteredBy: string | null; marketer?: string | null; marketerId?: string | null; items: Item[]; orderId: string | null; invoiceNo: string | null;
    canEditServices: boolean; canEditBill?: boolean; currentServiceIds: string[];
    depositAED?: number; depositPaidAt?: string | null;
  };
  services: ServiceOpt[];
  staff?: { id: string; name: string; role?: string }[];
}) {
  const ref = "QA-" + b.id.slice(-8).toUpperCase();
  const total = b.items.reduce((s, i) => s + i.price, 0);
  const duration = b.items.reduce((s, i) => s + i.duration, 0);
  const serviceNames = b.items.map((i) => i.name);
  const clientDigits = (b.phone ?? "").replace(/\D/g, "");
  const artistDigits = (b.staffPhone ?? "").replace(/\D/g, "");

  // Resolve each service line's artist (per-service artist → main Crown Artist fallback), and the
  // distinct set across the whole booking — so editing the invoice's artist(s) shows up here, and a
  // booking with different artists per service lists every one of them.
  const staffNameById = new Map(staff.map((s) => [s.id, s.name] as const));
  const artistFor = (it: Item): string | null =>
    (it.staffId && staffNameById.get(it.staffId)) || b.staffName || null;
  const artistNames = Array.from(
    new Set(b.items.map((it) => it.staffId && staffNameById.get(it.staffId)).filter((n): n is string => !!n)),
  );
  if (!artistNames.length && b.staffName) artistNames.push(b.staffName);

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
            <h3 className="font-display text-2xl text-cream">{b.name}</h3>
            <div className="mt-0.5 flex items-center gap-2 text-xs">
              <span className="font-mono text-muted">{ref}</span>
              <span className={cn("font-semibold", STATUS_CLR[b.status])}>{b.status.replace("_", " ")}</span>
              <span className="rounded-full border border-ink-line px-2 py-0.5 text-[0.6rem] text-sand">{SOURCE_LABEL[b.source] ?? b.source}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-cream"><X size={20} /></button>
        </div>

        {/* services */}
        <div className="rounded-xl border border-ink-line/60 p-3">
          <div className="mb-1.5 text-[0.65rem] uppercase tracking-wider text-muted">Services ({b.items.length})</div>
          <ul className="divide-y divide-ink-line/40">
            {b.items.map((it, i) => (
              <li key={i} className="flex items-start justify-between gap-3 py-1.5 text-sm">
                <div className="min-w-0">
                  <div className="text-cream">{it.name} <span className="text-xs text-muted">· {it.duration} min</span></div>
                  {artistFor(it) && <div className="mt-0.5 flex items-center gap-1 text-xs text-muted"><Scissors size={11} className="text-gold/70" /> {artistFor(it)}</div>}
                </div>
                <span className="tabular-nums text-gold">{aed(it.price)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center justify-between border-t border-ink-line pt-2 text-sm">
            <span className="text-muted">{duration} min total</span>
            <span className="font-semibold text-cream">{aed(total)}</span>
          </div>
        </div>

        {/* meta */}
        <div className="mt-2 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          <Row icon={<Clock size={15} />} label="When">{b.whenLabel}</Row>
          <Row icon={<MapPin size={15} />} label="Where">
            {b.serviceMode === "HOME" ? <>Home service{b.address ? <div className="text-xs text-muted">{b.address}</div> : null}</> : "At the salon"}
          </Row>
          <Row icon={<Scissors size={15} />} label={artistNames.length > 1 ? "Crown Artists" : "Crown Artist"}>{artistNames.length ? artistNames.join(", ") : "Any available"}</Row>
          <Row icon={<UserCheck size={15} />} label="Entered by">{b.enteredBy ?? "—"}</Row>
          {b.marketer && <Row icon={<Megaphone size={15} />} label="Referral (marketer)">{b.marketer}</Row>}
        </div>

        <div className="mt-1 space-y-1 text-sm">
          <div className="text-xs text-muted">
            <a href={`tel:${b.phone}`} className="hover:text-gold">{b.phone || "—"}</a>
            {b.email ? <> · <a href={`mailto:${b.email}`} className="hover:text-gold">{b.email}</a></> : null}
          </div>
          {b.customRequest && <div className="text-xs italic text-sand">Request: {b.customRequest}</div>}
          {b.notes && <div className="text-xs italic text-muted">“{b.notes}”</div>}
          {b.invoiceNo && <div className="text-xs text-green-400">Billed · {b.invoiceNo}</div>}
        </div>

        {/* Deposit tracker — managers/reception can manage it regardless of booking status (e.g. mark a
            late transfer received, or record a refund after a cancellation); others see it read-only. */}
        {(b.canEditBill || (b.depositAED ?? 0) > 0) && (
          <DepositControl bookingId={b.id} depositAED={b.depositAED ?? 0} depositPaidAt={b.depositPaidAt ?? null} canEdit={!!b.canEditBill} />
        )}

        {/* actions */}
        <div className="mt-5 flex flex-wrap gap-2 border-t border-ink-line pt-4">
          {clientDigits && (
            <a href={whatsappLink(clientDigits, salonToClientMessage({ customerName: b.name, services: serviceNames, whenLabel: b.whenLabel, serviceMode: b.serviceMode, address: b.address, ref }))}
               target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-1.5 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-1.5 text-xs text-green-400 hover:bg-green-500/20">
              <MessageCircle size={13} /> WhatsApp client
            </a>
          )}
          {artistDigits && (
            <a href={whatsappLink(artistDigits, artistReminderMessage({ artistName: b.staffName ?? "there", customerName: b.name, services: serviceNames, whenLabel: b.whenLabel, serviceMode: b.serviceMode, address: b.address }))}
               target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-1.5 rounded-lg border border-gold/40 px-3 py-1.5 text-xs text-gold hover:bg-gold/10">
              <MessageCircle size={13} /> Remind artist
            </a>
          )}
          {b.canEditServices && services.length > 0 && (
            <EditBookingServices
              bookingId={b.id}
              services={services}
              staff={staff}
              initialServiceIds={b.currentServiceIds}
              initialPrices={Object.fromEntries(b.items.filter((it) => it.serviceId).map((it) => [it.serviceId as string, it.price]))}
              initialStaff={Object.fromEntries(b.items.filter((it) => it.serviceId && it.staffId).map((it) => [it.serviceId as string, it.staffId as string]))}
              initialStartISO={b.startISO}
              initialMarketerId={b.marketerId ?? null}
              initialStaffId={b.staffId ?? null}
              initialNotes={b.notes}
              initialMode={b.serviceMode ?? "SALON"}
              initialAddress={b.address ?? null}
              initialCustomRequest={b.customRequest ?? null}
              initialName={b.name}
              initialPhone={b.phone}
              initialEmail={b.email}
            />
          )}
          {b.orderId && b.invoiceNo ? (
            <>
              {b.canEditBill && <Link href={`/erp/pos?orderId=${b.orderId}`} className="inline-flex items-center gap-1.5 rounded-lg border border-ink-line px-3 py-1.5 text-xs text-sand hover:text-gold">Edit bill</Link>}
              <a href={`/api/erp/invoice/${b.invoiceNo}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-gold/40 px-3 py-1.5 text-xs text-gold hover:bg-gold/10"><Printer size={13} /> Invoice</a>
            </>
          ) : (
            (b.status === "CONFIRMED" || b.status === "COMPLETED") && (
              <Link href={`/erp/pos?bookingId=${b.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-gold/40 px-3 py-1.5 text-xs text-gold hover:bg-gold/10"><Receipt size={13} /> Generate bill</Link>
            )
          )}
        </div>
      </div>
    </div>
  );
}

/** Reception/admin deposit tracker: adjust the requested amount and mark the transfer received. */
function DepositControl({ bookingId, depositAED, depositPaidAt, canEdit }: {
  bookingId: string; depositAED: number; depositPaidAt: string | null; canEdit: boolean;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState<number | "">(depositAED || "");
  const [busy, setBusy] = useState(false);
  const paid = !!depositPaidAt;

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/erp/bookings/${bookingId}/deposit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) router.refresh();
    } finally { setBusy(false); }
  }

  const paidLabel = depositPaidAt
    ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", day: "numeric", month: "short" }).format(new Date(depositPaidAt))
    : null;

  return (
    <div className="mt-4 rounded-xl border border-ink-line/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-cream">
          <Wallet size={15} className="text-gold" />
          {depositAED > 0 ? (
            <span>Deposit {aed(depositAED)} · {paid ? <span className="text-green-400">received{paidLabel ? ` ${paidLabel}` : ""}</span> : <span className="text-gold">pending</span>}</span>
          ) : (
            <span className="text-muted">No deposit requested</span>
          )}
        </div>
        {canEdit && depositAED > 0 && (
          <button
            onClick={() => patch({ paid: !paid })}
            disabled={busy}
            className={cn("shrink-0 rounded-lg border px-3 py-1.5 text-xs disabled:opacity-50",
              paid ? "border-ink-line text-sand hover:text-cream" : "border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/20")}
          >
            {paid ? "Mark unpaid" : "Mark received"}
          </button>
        )}
      </div>
      {canEdit && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number" min={0} value={amount} placeholder="Amount"
            onChange={(e) => setAmount(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
            className="w-28 rounded-lg border border-ink-line bg-ink-card px-2 py-1.5 text-xs text-cream outline-none focus:border-gold/60"
          />
          <button
            onClick={() => patch({ depositAED: amount === "" ? 0 : Number(amount) })}
            disabled={busy || (amount === "" ? 0 : Number(amount)) === depositAED}
            className="rounded-lg border border-gold/40 px-3 py-1.5 text-xs text-gold hover:bg-gold/10 disabled:opacity-40"
          >
            {depositAED > 0 ? "Update amount" : "Request deposit"}
          </button>
          {depositAED > 0 && (
            <button onClick={() => { setAmount(""); patch({ depositAED: 0, paid: false }); }} disabled={busy} className="text-xs text-muted hover:text-red-600 disabled:opacity-40">Waive</button>
          )}
        </div>
      )}
    </div>
  );
}
