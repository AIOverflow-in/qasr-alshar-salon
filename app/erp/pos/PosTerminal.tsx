"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Trash2, Printer, CheckCircle2, Loader2, X, UserPlus, CalendarCheck, Send, MessageCircle, Link2 } from "lucide-react";
import { cn, aed } from "@/lib/utils";

const VAT_PCT = 5;

type Service = { id: string; name: string; category: string; priceAED: number; durationMin: number };
type ProductItem = { id: string; name: string; category: string; saleAED: number | null; qty: number };
type StaffMember = { id: string; name: string; commissionPct?: number; role?: string };
type Client = { id: string; name: string; phone: string | null };

type LineItem = {
  key: string;
  kind: "SERVICE" | "PRODUCT";
  description: string;
  qty: number;
  unitAED: number;
  productId?: string | null;
  staffIds: string[]; // artist(s) who did this line (empty = main artist); commission splits equally
};

export type PosPrefill = {
  bookingId?: string;
  orderId?: string; // editing an existing invoice
  invoiceNo?: string;
  lines?: { description: string; qty: number; unitAED: number; kind?: "SERVICE" | "PRODUCT"; productId?: string | null; staffId?: string | null; staffIds?: string[] }[];
  staffId?: string;
  marketerId?: string;
  paymentMethod?: "CASH" | "CARD" | "TRANSFER";
  splitPayment?: boolean;
  cashAED?: number;
  cardAED?: number;
  transferAED?: number;
  commissions?: { staffId: string; amountAED: number }[]; // existing per-artist commissions (edit mode)
  marketerCommission?: number; // existing marketer/referral commission (edit mode)
  client?: { id?: string; name?: string; phone?: string | null; email?: string | null };
  bookingLabel?: string;
};

export function PosTerminal({ services, staff, clients: initialClients, products = [], prefill, attachableBookings = [] }: {
  services: Service[];
  staff: StaffMember[];
  clients: Client[];
  products?: ProductItem[];
  prefill?: PosPrefill;
  attachableBookings?: { id: string; customerName: string; phone: string | null; serviceName: string; whenLabel: string }[];
}) {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [bookingQuery, setBookingQuery] = useState("");
  const [pickerTab, setPickerTab] = useState<"service" | "product">("service");
  const [lines, setLines] = useState<LineItem[]>(
    (prefill?.lines ?? []).map((l, i) => ({
      key: `pre-${i}`,
      kind: l.kind ?? "SERVICE",
      description: l.description,
      qty: l.qty,
      unitAED: l.unitAED,
      productId: l.productId ?? null,
      staffIds: l.staffIds ?? (l.staffId ? [l.staffId] : []),
    }))
  );
  const [query, setQuery] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<string>(prefill?.staffId ?? "");
  const [selectedMarketer, setSelectedMarketer] = useState<string>(prefill?.marketerId ?? "");
  const [selectedClient, setSelectedClient] = useState<string>(prefill?.client?.id ?? "");
  const [clientQuery, setClientQuery] = useState(prefill?.client?.id ? prefill.client.name ?? "" : "");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "TRANSFER">(prefill?.paymentMethod ?? "CASH");
  const [split, setSplit] = useState<boolean>(prefill?.splitPayment ?? false);
  const [cashAED, setCashAED] = useState<number | "">(prefill?.cashAED ?? "");
  const [cardAED, setCardAED] = useState<number | "">(prefill?.cardAED ?? "");
  const [transferAED, setTransferAED] = useState<number | "">(prefill?.transferAED ?? "");
  // Per-artist commission overrides (AED). Empty for an artist ⇒ auto-compute from their %.
  const [commissionEdits, setCommissionEdits] = useState<Record<string, number>>(
    () => Object.fromEntries((prefill?.commissions ?? []).map((c) => [c.staffId, c.amountAED]))
  );
  const [marketerCommission, setMarketerCommission] = useState<number | "">(prefill?.marketerCommission ?? "");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastInvoice, setLastInvoice] = useState<{ invoiceNo: string; totalAED: number; clientEmail: string | null; clientPhone: string | null } | null>(null);
  const [bookingId] = useState<string | undefined>(prefill?.bookingId);
  const [orderId] = useState<string | undefined>(prefill?.orderId);
  const editing = !!orderId;
  // Idempotency key for this sale — set on first charge, cleared on New Sale.
  // Lets a network retry land on the same invoice instead of double-charging.
  const requestIdRef = useRef<string | null>(null);

  // ── inline new-client ──────────────────────────────────────────────────
  // If a booking's customer isn't a saved client yet, open the form pre-filled so the
  // name is visible (not hidden) — it still saves the client on checkout.
  const [showNewClient, setShowNewClient] = useState(!!(prefill?.client && !prefill.client.id && (prefill.client.name || prefill.client.phone)));
  const [newClient, setNewClient] = useState({
    name: prefill?.client && !prefill.client.id ? prefill.client.name ?? "" : "",
    phone: prefill?.client && !prefill.client.id ? prefill.client.phone ?? "" : "",
    email: prefill?.client && !prefill.client.id ? prefill.client.email ?? "" : "",
  });
  const [creatingClient, setCreatingClient] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services.slice(0, 20);
    return services.filter((s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)).slice(0, 30);
  }, [services, query]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? products.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)) : products;
    return list.slice(0, 40);
  }, [products, query]);

  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return clients.slice(0, 8);
    return clients.filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q)).slice(0, 8);
  }, [clients, clientQuery]);

  const selectedClientObj = clients.find((c) => c.id === selectedClient) ?? null;

  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitAED, 0);
  const vatAED = Math.round(subtotal * VAT_PCT / 100);
  const total = subtotal + vatAED;

  const n = (v: number | "") => (v === "" ? 0 : v);
  const splitSum = n(cashAED) + n(cardAED) + n(transferAED);
  const splitRemaining = total - splitSum;
  const splitValid = !split || splitSum === total;

  const bookingMatches = useMemo(() => {
    const q = bookingQuery.trim().toLowerCase();
    const list = q
      ? attachableBookings.filter((b) => b.customerName.toLowerCase().includes(q) || (b.phone ?? "").includes(q) || b.serviceName.toLowerCase().includes(q))
      : attachableBookings;
    return list.slice(0, 8);
  }, [attachableBookings, bookingQuery]);

  function attachBooking(id: string) {
    if (lines.length > 0 && !window.confirm("Load this booking? It will replace the items currently in the cart.")) return;
    router.push(`/erp/pos?bookingId=${id}`);
  }

  // Commission is on SERVICES only. Each artist's base = their share of the service lines;
  // auto = base × their %. Mirrors the server so untouched rows match exactly.
  const commissionRows = useMemo(() => {
    const baseByStaff = new Map<string, number>();
    for (const l of lines) {
      if (l.kind !== "SERVICE") continue;
      const lineAED = l.qty * l.unitAED;
      const artists = l.staffIds.length ? l.staffIds : (selectedStaff ? [selectedStaff] : []);
      if (!artists.length) continue;
      const share = lineAED / artists.length;
      for (const sid of artists) baseByStaff.set(sid, (baseByStaff.get(sid) ?? 0) + share);
    }
    return [...baseByStaff.entries()].map(([staffId, base]) => {
      const pct = staff.find((s) => s.id === staffId)?.commissionPct ?? 40;
      return { staffId, name: staff.find((s) => s.id === staffId)?.name ?? "—", base, auto: Math.round(base * pct / 100) };
    });
  }, [lines, selectedStaff, staff]);

  const setCommission = (staffId: string, v: number | "") =>
    setCommissionEdits((prev) => {
      const next = { ...prev };
      if (v === "") delete next[staffId]; else next[staffId] = v;
      return next;
    });

  // Marketer/referral commission: default 5% of the service value, editable to any amount.
  const servicesSubtotal = useMemo(() => lines.reduce((s, l) => (l.kind === "SERVICE" ? s + l.qty * l.unitAED : s), 0), [lines]);
  const marketerName = staff.find((s) => s.id === selectedMarketer)?.name ?? "Marketer";
  const marketerAuto = selectedMarketer && servicesSubtotal > 0 ? Math.round(servicesSubtotal * 5 / 100) : 0;

  function addService(s: Service) {
    const key = `svc-${s.id}`;
    setLines((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) return prev.map((l) => l.key === key ? { ...l, qty: l.qty + 1 } : l);
      return [...prev, { key, kind: "SERVICE", description: s.name, qty: 1, unitAED: s.priceAED, staffIds: [] }];
    });
  }

  function addProduct(p: ProductItem) {
    const key = `prod-${p.id}`;
    setLines((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) return prev.map((l) => l.key === key ? { ...l, qty: l.qty + 1 } : l);
      return [...prev, { key, kind: "PRODUCT", description: p.name, qty: 1, unitAED: p.saleAED ?? 0, productId: p.id, staffIds: [] }];
    });
  }

  function addCustomLine() {
    const key = `custom-${lines.length}-${Math.round(subtotal)}`;
    setLines((prev) => [...prev, { key: `${key}-${prev.length}`, kind: "SERVICE", description: "Custom item", qty: 1, unitAED: 0, staffIds: [] }]);
  }

  function updateLine(key: string, patch: Partial<LineItem>) {
    setLines((prev) => prev.map((l) => l.key === key ? { ...l, ...patch } : l));
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  async function createClient() {
    if (!newClient.name.trim()) { setError("Client name is required."); return; }
    setCreatingClient(true);
    setError(null);
    try {
      const res = await fetch("/api/erp/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newClient.name.trim(),
          phone: newClient.phone.trim() || null,
          email: newClient.email.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Could not add client."); return; }
      const c: Client = { id: data.client.id, name: data.client.name, phone: data.client.phone };
      setClients((prev) => [c, ...prev]);
      setSelectedClient(c.id);
      setClientQuery(c.name);
      setShowNewClient(false);
    } catch { setError("Network error adding client."); }
    finally { setCreatingClient(false); }
  }

  function reset() {
    setLines([]);
    setSelectedStaff("");
    setSelectedClient("");
    setClientQuery("");
    setPaymentMethod("CASH");
    setNotes("");
    setError(null);
    setLastInvoice(null);
    setQuery("");
    requestIdRef.current = null; // fresh idempotency key for the next sale
  }

  async function checkout() {
    if (lines.length === 0) { setError("Add at least one item."); return; }
    if (split && splitSum !== total) { setError(`Split amounts (AED ${splitSum}) must add up to the total (AED ${total}).`); return; }
    if (submitting) return;
    if (!editing && !requestIdRef.current) requestIdRef.current = crypto.randomUUID();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/erp/pos", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editing ? { orderId } : { clientRequestId: requestIdRef.current }),
          paymentMethod,
          splitPayment: split,
          ...(split ? { cashAED: n(cashAED), cardAED: n(cardAED), transferAED: n(transferAED) } : {}),
          commissions: Object.entries(commissionEdits).map(([staffId, amountAED]) => ({ staffId, amountAED })),
          marketerAmountAED: marketerCommission === "" ? undefined : marketerCommission,
          staffId: selectedStaff || null,
          marketerId: selectedMarketer || null,
          clientId: selectedClient || null,
          // When no client is picked, pass the name so the bill links a client instead of "Walk-in".
          customerName: selectedClient ? null : (newClient.name.trim() || clientQuery.trim() || null),
          customerPhone: selectedClient ? null : (newClient.phone.trim() || null),
          customerEmail: selectedClient ? null : (newClient.email.trim() || null),
          bookingId: bookingId || null,
          notes: notes || null,
          lines: lines.map((l) => ({ kind: l.kind, description: l.description, qty: l.qty, unitAED: l.unitAED, productId: l.productId ?? null, staffId: l.staffIds[0] ?? null, staffIds: l.staffIds })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Checkout failed."); return; }
      setLastInvoice({
        invoiceNo: data.order.invoiceNo,
        totalAED: data.order.totalAED,
        clientEmail: selectedClientObj?.phone ? null : null,
        clientPhone: selectedClientObj?.phone ?? newClient.phone ?? null,
      });
    } catch { setError("Network error — please try again."); }
    finally { setSubmitting(false); }
  }

  if (lastInvoice) {
    const invoiceUrl = `/api/erp/invoice/${lastInvoice.invoiceNo}`;
    const phone = (lastInvoice.clientPhone ?? "").replace(/\D/g, "");
    const waText = encodeURIComponent(
      `Hello from Qasr Alshar Salon 👑\nThank you for your visit! Your invoice ${lastInvoice.invoiceNo} for ${aed(lastInvoice.totalAED)} is ready.`
    );
    const waUrl = phone ? `https://wa.me/${phone}?text=${waText}` : null;
    return (
      <div className="mx-auto max-w-md text-center py-12">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gold/15 text-gold">
          <CheckCircle2 size={44} />
        </div>
        <h2 className="mt-6 font-display text-3xl text-cream">Payment received</h2>
        <p className="mt-2 text-sand">{lastInvoice.invoiceNo}</p>
        <p className="mt-1 text-2xl font-semibold text-gold">{aed(lastInvoice.totalAED)} <span className="text-sm font-normal text-muted">incl. VAT 5%</span></p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href={invoiceUrl} target="_blank" className="inline-flex items-center gap-2 rounded-full border border-gold/40 px-5 py-2.5 text-sm text-gold hover:bg-gold/10">
            <Printer size={15} /> Print / PDF
          </a>
          {waUrl && (
            <a href={waUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-green-500/50 px-5 py-2.5 text-sm text-green-400 hover:bg-green-500/10">
              <MessageCircle size={15} /> Send on WhatsApp
            </a>
          )}
          <button onClick={reset} className="inline-flex items-center gap-2 rounded-full bg-gold-gradient px-5 py-2.5 text-sm font-semibold text-espresso">
            New Sale
          </button>
        </div>
        <p className="mt-4 text-xs text-muted">A copy was emailed to the client automatically (if an email is on file).</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      {/* Left — service picker */}
      <div className="space-y-4">
        {editing && (
          <div className="flex items-center gap-2 rounded-xl border border-blue-400/40 bg-blue-400/10 px-4 py-2.5 text-sm text-blue-300">
            <CalendarCheck size={16} /> Editing invoice {prefill?.invoiceNo ?? ""} — change items below and save to update the bill.
          </div>
        )}
        {bookingId && !editing && (
          <div className="flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/5 px-4 py-2.5 text-sm text-gold">
            <CalendarCheck size={16} /> Billing booking {prefill?.bookingLabel ? `· ${prefill.bookingLabel}` : ""} — add, drop or edit items below before charging.
          </div>
        )}
        {!editing && !bookingId && attachableBookings.length > 0 && (
          <div className="rounded-xl border border-ink-line bg-ink-card/40 px-4 py-3">
            <div className="mb-2 flex items-center gap-2 text-sm text-sand">
              <Link2 size={15} className="text-gold" /> Is this for a booking? Attach it so the booking is marked billed.
            </div>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={bookingQuery}
                onChange={(e) => setBookingQuery(e.target.value)}
                placeholder="Search bookings by client, phone or service…"
                className="w-full rounded-lg border border-ink-line bg-ink-card py-2 pl-9 pr-3 text-sm text-cream outline-none placeholder:text-muted focus:border-gold/60"
              />
            </div>
            {bookingMatches.length > 0 ? (
              <div className="mt-2 max-h-56 divide-y divide-ink-line/50 overflow-y-auto rounded-lg border border-ink-line/50">
                {bookingMatches.map((b) => (
                  <button key={b.id} onClick={() => attachBooking(b.id)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-start hover:bg-gold/5">
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-cream">{b.customerName} <span className="text-xs text-muted">{b.phone ?? ""}</span></span>
                      <span className="block truncate text-xs text-muted">{b.serviceName} · {b.whenLabel}</span>
                    </span>
                    <span className="shrink-0 text-xs text-gold">Attach →</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted">No matching unbilled booking — continue as a walk-in.</p>
            )}
          </div>
        )}
        {/* Services / Products toggle */}
        <div className="flex gap-2">
          {(["service", "product"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setPickerTab(t)}
              className={cn("flex-1 rounded-xl border py-2 text-sm font-semibold capitalize transition-colors",
                pickerTab === t ? "border-gold bg-gold/15 text-gold" : "border-ink-line text-muted hover:border-gold/40"
              )}
            >
              {t === "service" ? "Services" : `Products${products.length ? ` (${products.length})` : ""}`}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={pickerTab === "service" ? "Search services…" : "Search products…"}
            className="w-full rounded-xl border border-ink-line bg-ink-card py-2.5 pl-9 pr-4 text-cream placeholder:text-muted focus:border-gold/60 outline-none text-sm"
          />
        </div>
        <div className="surface rounded-2xl overflow-hidden">
          <div className="grid divide-y divide-ink-line/60 max-h-[50vh] overflow-y-auto">
            {pickerTab === "service" && filtered.map((s) => (
              <button
                key={s.id}
                onClick={() => addService(s)}
                className="flex items-center justify-between px-4 py-3 text-start hover:bg-gold/5 transition-colors"
              >
                <div>
                  <div className="text-cream text-sm">{s.name}</div>
                  <div className="text-xs text-muted">{s.category}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gold text-sm font-semibold">{aed(s.priceAED)}</span>
                  <Plus size={16} className="text-muted" />
                </div>
              </button>
            ))}
            {pickerTab === "service" && filtered.length === 0 && <div className="px-4 py-8 text-center text-sm text-muted">No services found</div>}

            {pickerTab === "product" && filteredProducts.map((p) => (
              <button
                key={p.id}
                onClick={() => addProduct(p)}
                disabled={p.qty <= 0}
                className="flex items-center justify-between px-4 py-3 text-start hover:bg-gold/5 transition-colors disabled:opacity-40"
              >
                <div className="min-w-0">
                  <div className="truncate text-cream text-sm">{p.name}</div>
                  <div className="text-xs text-muted">{p.category} · <span className={p.qty === 0 ? "text-red-400" : p.qty <= 3 ? "text-gold" : ""}>{p.qty} in stock</span></div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-gold text-sm font-semibold">{p.saleAED ? aed(p.saleAED) : "—"}</span>
                  <Plus size={16} className="text-muted" />
                </div>
              </button>
            ))}
            {pickerTab === "product" && filteredProducts.length === 0 && <div className="px-4 py-8 text-center text-sm text-muted">No products found</div>}
          </div>
        </div>
        <button onClick={addCustomLine} className="text-sm text-muted hover:text-gold transition-colors">+ Add custom line</button>
      </div>

      {/* Right — cart + summary */}
      <div className="space-y-3">
        {/* client + staff selectors */}
        <div className="surface rounded-2xl p-4 space-y-3">
          <div>
            <label className="text-xs text-muted mb-1.5 block">Crown Artist (main)</label>
            <select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="w-full rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-cream text-sm outline-none focus:border-gold/60"
            >
              <option value="">— Any / walk-in —</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <p className="mt-1 text-[0.65rem] text-muted">Used for any line without its own artist set below.</p>
          </div>
          <div>
            <label className="text-xs text-muted mb-1.5 block">Marketer (referral 5%)</label>
            <select
              value={selectedMarketer}
              onChange={(e) => setSelectedMarketer(e.target.value)}
              className="w-full rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-cream text-sm outline-none focus:border-gold/60"
            >
              <option value="">— None —</option>
              {staff.filter((s) => /market/i.test(s.role ?? "")).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-muted">Client</label>
              <button
                onClick={() => setShowNewClient((v) => !v)}
                className="inline-flex items-center gap-1 text-xs text-gold hover:text-gold-deep"
              >
                <UserPlus size={12} /> {showNewClient ? "Cancel" : "New client"}
              </button>
            </div>

            {showNewClient ? (
              <div className="space-y-2 rounded-lg border border-gold/30 bg-gold/5 p-3">
                <input
                  value={newClient.name}
                  onChange={(e) => setNewClient((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Full name *"
                  className="w-full rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-cream text-sm outline-none focus:border-gold/60"
                />
                <input
                  value={newClient.phone}
                  onChange={(e) => setNewClient((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="Phone"
                  className="w-full rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-cream text-sm outline-none focus:border-gold/60"
                />
                <input
                  value={newClient.email}
                  onChange={(e) => setNewClient((p) => ({ ...p, email: e.target.value }))}
                  placeholder="Email (for the invoice)"
                  className="w-full rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-cream text-sm outline-none focus:border-gold/60"
                />
                <button
                  onClick={createClient}
                  disabled={creatingClient}
                  className="w-full rounded-lg bg-gold-gradient py-2 text-sm font-semibold text-espresso disabled:opacity-50"
                >
                  {creatingClient ? "Adding…" : "Add & select client"}
                </button>
              </div>
            ) : (
              <>
                <input
                  value={clientQuery}
                  onChange={(e) => { setClientQuery(e.target.value); setSelectedClient(""); }}
                  placeholder="Search by name or phone…"
                  className="w-full rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-cream text-sm outline-none focus:border-gold/60"
                />
                {selectedClientObj && (
                  <div className="mt-1.5 inline-flex items-center gap-2 rounded-full bg-gold/10 px-3 py-1 text-xs text-gold">
                    <CheckCircle2 size={12} /> {selectedClientObj.name}
                  </div>
                )}
                {clientQuery && !selectedClientObj && filteredClients.length > 0 && (
                  <div className="mt-1 rounded-lg border border-ink-line bg-ink-card shadow-lg divide-y divide-ink-line/60">
                    {filteredClients.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => { setSelectedClient(c.id); setClientQuery(c.name); }}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gold/5 text-start"
                      >
                        <span className="text-sm text-cream">{c.name}</span>
                        <span className="text-xs text-muted">{c.phone ?? ""}</span>
                      </button>
                    ))}
                  </div>
                )}
                {clientQuery && !selectedClientObj && filteredClients.length === 0 && (
                  <button
                    onClick={() => { setNewClient((p) => ({ ...p, name: clientQuery })); setShowNewClient(true); }}
                    className="mt-1.5 text-xs text-gold hover:text-gold-deep"
                  >
                    + Add “{clientQuery}” as a new client
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* line items */}
        <div className="surface rounded-2xl p-4 space-y-2 min-h-[160px]">
          {lines.length === 0 && <p className="text-center text-sm text-muted py-6">Add services from the list →</p>}
          {lines.map((l) => (
            <div key={l.key} className="rounded-lg border border-ink-line/40 p-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <input
                  value={l.description}
                  onChange={(e) => updateLine(l.key, { description: e.target.value })}
                  className="flex-1 rounded border border-ink-line/50 bg-transparent px-2 py-1 text-sm text-cream outline-none focus:border-gold/40 min-w-0"
                />
                <input
                  type="number"
                  value={l.qty}
                  min={1}
                  onChange={(e) => updateLine(l.key, { qty: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="w-12 rounded border border-ink-line/50 bg-transparent px-2 py-1 text-center text-sm text-cream outline-none"
                />
                <input
                  type="number"
                  value={l.unitAED}
                  min={0}
                  onChange={(e) => updateLine(l.key, { unitAED: parseInt(e.target.value) || 0 })}
                  className="w-20 rounded border border-ink-line/50 bg-transparent px-2 py-1 text-right text-sm text-gold outline-none"
                />
                <button onClick={() => removeLine(l.key)} className="text-muted hover:text-red-400 transition-colors flex-shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
              {staff.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {l.staffIds.map((id) => {
                    const s = staff.find((x) => x.id === id);
                    if (!s) return null;
                    return (
                      <span key={id} className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[0.7rem] text-gold">
                        {s.name}
                        <button
                          onClick={() => updateLine(l.key, { staffIds: l.staffIds.filter((x) => x !== id) })}
                          className="hover:text-gold-deep"
                          aria-label={`Remove ${s.name}`}
                        >
                          <X size={10} />
                        </button>
                      </span>
                    );
                  })}
                  <select
                    value=""
                    onChange={(e) => { if (e.target.value) updateLine(l.key, { staffIds: [...l.staffIds, e.target.value] }); }}
                    className="rounded border border-ink-line/40 bg-transparent px-2 py-1 text-[0.7rem] text-muted outline-none focus:border-gold/40"
                  >
                    <option value="">{l.staffIds.length ? "+ Add artist" : "By: main artist"}</option>
                    {staff.filter((s) => !l.staffIds.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {l.staffIds.length > 1 && <span className="text-[0.65rem] text-muted">· commission split equally</span>}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* totals */}
        <div className="surface rounded-2xl p-4 space-y-2 text-sm">
          <div className="flex justify-between text-muted"><span>Subtotal</span><span>{aed(subtotal)}</span></div>
          <div className="flex justify-between text-muted"><span>VAT 5%</span><span>{aed(vatAED)}</span></div>
          <div className="flex justify-between font-semibold text-cream border-t border-ink-line pt-2 text-base"><span>Total</span><span className="text-gold">{aed(total)}</span></div>
        </div>

        {/* commission (services only) — auto from each artist's %, editable per artist */}
        {(commissionRows.length > 0 || (selectedMarketer && servicesSubtotal > 0)) && (
          <div className="surface rounded-2xl p-4 space-y-2">
            <div className="text-xs text-muted">Commission (services only) — auto by %, edit any amount</div>
            {commissionRows.map((c) => {
              const edited = c.staffId in commissionEdits;
              const value = edited ? commissionEdits[c.staffId] : c.auto;
              return (
                <div key={c.staffId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate text-cream">{c.name}<span className="text-xs text-muted"> · on {aed(c.base)}</span></span>
                  <span className="flex shrink-0 items-center gap-1">
                    {edited && (
                      <button onClick={() => setCommission(c.staffId, "")} className="text-[0.65rem] text-muted underline hover:text-gold" title={`Reset to auto (${aed(c.auto)})`}>auto</button>
                    )}
                    <span className="text-xs text-muted">AED</span>
                    <input
                      type="number" min={0} inputMode="numeric"
                      value={value}
                      onChange={(e) => setCommission(c.staffId, e.target.value === "" ? "" : Math.max(0, Math.round(Number(e.target.value))))}
                      className={cn("w-20 rounded-lg border bg-transparent px-2 py-1.5 text-sm text-cream outline-none focus:border-gold/40", edited ? "border-gold/50" : "border-ink-line")}
                    />
                  </span>
                </div>
              );
            })}
            {selectedMarketer && servicesSubtotal > 0 && (
              <div className="flex items-center justify-between gap-2 border-t border-ink-line/50 pt-2 text-sm">
                <span className="min-w-0 truncate text-cream">Referral · {marketerName}<span className="text-xs text-muted"> · 5% of services</span></span>
                <span className="flex shrink-0 items-center gap-1">
                  {marketerCommission !== "" && (
                    <button onClick={() => setMarketerCommission("")} className="text-[0.65rem] text-muted underline hover:text-gold" title={`Reset to auto (${aed(marketerAuto)})`}>auto</button>
                  )}
                  <span className="text-xs text-muted">AED</span>
                  <input
                    type="number" min={0} inputMode="numeric"
                    value={marketerCommission === "" ? marketerAuto : marketerCommission}
                    onChange={(e) => setMarketerCommission(e.target.value === "" ? "" : Math.max(0, Math.round(Number(e.target.value))))}
                    className={cn("w-20 rounded-lg border bg-transparent px-2 py-1.5 text-sm text-cream outline-none focus:border-gold/40", marketerCommission !== "" ? "border-gold/50" : "border-ink-line")}
                  />
                </span>
              </div>
            )}
          </div>
        )}

        {/* payment method */}
        <div className="surface rounded-2xl p-4 space-y-2">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs text-muted">Payment{split ? " — split across methods" : " method"}</div>
            <button onClick={() => setSplit((v) => !v)} className="text-xs text-gold hover:text-gold-deep">
              {split ? "Single method" : "Split payment"}
            </button>
          </div>
          {!split ? (
            <div className="flex gap-2">
              {(["CASH", "CARD", "TRANSFER"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={cn("flex-1 rounded-lg border py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
                    paymentMethod === m ? "border-gold bg-gold/15 text-gold" : "border-ink-line text-muted hover:border-gold/40"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                {([["Cash", cashAED, setCashAED], ["Card", cardAED, setCardAED], ["Transfer", transferAED, setTransferAED]] as const).map(([label, val, setter]) => (
                  <div key={label}>
                    <label className="mb-1 block text-[0.6rem] uppercase tracking-wide text-muted">{label}</label>
                    <input
                      type="number" min={0} inputMode="numeric"
                      value={val}
                      onChange={(e) => setter(e.target.value === "" ? "" : Math.max(0, Math.round(Number(e.target.value))))}
                      placeholder="0"
                      className="w-full rounded-lg border border-ink-line bg-transparent px-2 py-1.5 text-sm text-cream outline-none focus:border-gold/40"
                    />
                  </div>
                ))}
              </div>
              <div className={cn("flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs",
                splitRemaining === 0 ? "bg-green-500/10 text-green-400" : "bg-gold/10 text-gold")}>
                <span>
                  {splitRemaining === 0 ? "✓ Balanced" : splitRemaining > 0 ? `Remaining: ${aed(splitRemaining)}` : `Over by ${aed(-splitRemaining)}`}
                </span>
                <button
                  onClick={() => {
                    // drop the remainder into Cash to balance quickly
                    if (splitRemaining !== 0) setCashAED(Math.max(0, n(cashAED) + splitRemaining));
                  }}
                  className="text-muted underline hover:text-gold"
                >
                  balance to {aed(total)}
                </button>
              </div>
            </div>
          )}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)…"
            rows={2}
            className="w-full rounded-lg border border-ink-line bg-transparent px-3 py-2 text-sm text-cream placeholder:text-muted outline-none focus:border-gold/40 mt-1"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex items-start gap-2">
            <X size={14} className="mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={checkout}
          disabled={submitting || lines.length === 0 || total === 0 || !splitValid}
          className={cn(
            "w-full rounded-2xl py-4 font-semibold text-espresso transition-opacity text-base flex items-center justify-center gap-2",
            "bg-gold-gradient disabled:opacity-40"
          )}
        >
          {submitting ? <><Loader2 className="animate-spin" size={18} /> Processing…</> : <><Send size={16} /> {editing ? `Update invoice · ${aed(total)}` : `Charge ${aed(total)}`}</>}
        </button>
      </div>
    </div>
  );
}
