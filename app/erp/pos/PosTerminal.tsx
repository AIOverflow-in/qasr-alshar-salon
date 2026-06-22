"use client";

import { useState, useMemo, useRef } from "react";
import { Search, Plus, Trash2, Printer, CheckCircle2, Loader2, X } from "lucide-react";
import { cn, aed } from "@/lib/utils";

const VAT_PCT = 5;

type Service = { id: string; name: string; category: string; priceAED: number; durationMin: number };
type StaffMember = { id: string; name: string };
type Client = { id: string; name: string; phone: string | null };

type LineItem = {
  key: string;
  kind: "SERVICE" | "PRODUCT";
  description: string;
  qty: number;
  unitAED: number;
  productId?: string | null;
};

export function PosTerminal({ services, staff, clients }: {
  services: Service[];
  staff: StaffMember[];
  clients: Client[];
}) {
  const [lines, setLines] = useState<LineItem[]>([]);
  const [query, setQuery] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<string>("");
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [clientQuery, setClientQuery] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "TRANSFER">("CASH");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastInvoice, setLastInvoice] = useState<{ invoiceNo: string; totalAED: number } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services.slice(0, 20);
    return services.filter((s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)).slice(0, 30);
  }, [services, query]);

  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return clients.slice(0, 8);
    return clients.filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q)).slice(0, 8);
  }, [clients, clientQuery]);

  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitAED, 0);
  const vatAED = Math.round(subtotal * VAT_PCT / 100);
  const total = subtotal + vatAED;

  function addService(s: Service) {
    const key = `svc-${s.id}`;
    setLines((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) return prev.map((l) => l.key === key ? { ...l, qty: l.qty + 1 } : l);
      return [...prev, { key, kind: "SERVICE", description: s.name, qty: 1, unitAED: s.priceAED }];
    });
  }

  function addCustomLine() {
    const key = `custom-${Date.now()}`;
    setLines((prev) => [...prev, { key, kind: "SERVICE", description: "Custom item", qty: 1, unitAED: 0 }]);
  }

  function updateLine(key: string, patch: Partial<LineItem>) {
    setLines((prev) => prev.map((l) => l.key === key ? { ...l, ...patch } : l));
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
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
  }

  async function checkout() {
    if (lines.length === 0) { setError("Add at least one item."); return; }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/erp/pos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod,
          staffId: selectedStaff || null,
          clientId: selectedClient || null,
          notes: notes || null,
          lines: lines.map((l) => ({ kind: l.kind, description: l.description, qty: l.qty, unitAED: l.unitAED, productId: l.productId ?? null })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Checkout failed."); return; }
      setLastInvoice({ invoiceNo: data.order.invoiceNo, totalAED: data.order.totalAED });
    } catch { setError("Network error — please try again."); }
    finally { setSubmitting(false); }
  }

  if (lastInvoice) {
    return (
      <div className="mx-auto max-w-md text-center py-12">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gold/15 text-gold">
          <CheckCircle2 size={44} />
        </div>
        <h2 className="mt-6 font-display text-3xl text-cream">Payment received</h2>
        <p className="mt-2 text-sand">{lastInvoice.invoiceNo}</p>
        <p className="mt-1 text-2xl font-semibold text-gold">{aed(lastInvoice.totalAED)} <span className="text-sm font-normal text-muted">incl. VAT 5%</span></p>
        <div className="mt-8 flex justify-center gap-3">
          <a
            href={`/api/erp/invoice/${lastInvoice.invoiceNo}`}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-full border border-gold/40 px-5 py-2.5 text-sm text-gold hover:bg-gold/10"
          >
            <Printer size={15} /> Print Invoice
          </a>
          <button onClick={reset} className="inline-flex items-center gap-2 rounded-full bg-gold-gradient px-5 py-2.5 text-sm font-semibold text-espresso">
            New Sale
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      {/* Left — service picker */}
      <div className="space-y-4">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search services…"
            className="w-full rounded-xl border border-ink-line bg-ink-card py-2.5 pl-9 pr-4 text-cream placeholder:text-muted focus:border-gold/60 outline-none text-sm"
          />
        </div>
        <div className="surface rounded-2xl overflow-hidden">
          <div className="grid divide-y divide-ink-line/60 max-h-[50vh] overflow-y-auto">
            {filtered.map((s) => (
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
            {filtered.length === 0 && <div className="px-4 py-8 text-center text-sm text-muted">No services found</div>}
          </div>
        </div>
        <button onClick={addCustomLine} className="text-sm text-muted hover:text-gold transition-colors">+ Add custom line</button>
      </div>

      {/* Right — cart + summary */}
      <div className="space-y-3">
        {/* client + staff selectors */}
        <div className="surface rounded-2xl p-4 space-y-3">
          <div>
            <label className="text-xs text-muted mb-1.5 block">Crown Artist</label>
            <select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="w-full rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-cream text-sm outline-none focus:border-gold/60"
            >
              <option value="">— Any / walk-in —</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted mb-1.5 block">Client (optional)</label>
            <input
              value={clientQuery}
              onChange={(e) => setClientQuery(e.target.value)}
              placeholder="Search by name or phone…"
              className="w-full rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-cream text-sm outline-none focus:border-gold/60"
            />
            {clientQuery && filteredClients.length > 0 && (
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
          </div>
        </div>

        {/* line items */}
        <div className="surface rounded-2xl p-4 space-y-2 min-h-[160px]">
          {lines.length === 0 && <p className="text-center text-sm text-muted py-6">Add services from the list →</p>}
          {lines.map((l) => (
            <div key={l.key} className="flex items-center gap-2">
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
          ))}
        </div>

        {/* totals */}
        <div className="surface rounded-2xl p-4 space-y-2 text-sm">
          <div className="flex justify-between text-muted"><span>Subtotal</span><span>{aed(subtotal)}</span></div>
          <div className="flex justify-between text-muted"><span>VAT 5%</span><span>{aed(vatAED)}</span></div>
          <div className="flex justify-between font-semibold text-cream border-t border-ink-line pt-2 text-base"><span>Total</span><span className="text-gold">{aed(total)}</span></div>
        </div>

        {/* payment method */}
        <div className="surface rounded-2xl p-4 space-y-2">
          <div className="text-xs text-muted mb-2">Payment method</div>
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
          disabled={submitting || lines.length === 0 || total === 0}
          className={cn(
            "w-full rounded-2xl py-4 font-semibold text-espresso transition-opacity text-base",
            "bg-gold-gradient disabled:opacity-40"
          )}
        >
          {submitting ? <span className="flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={18} /> Processing…</span> : `Charge ${aed(total)}`}
        </button>
      </div>
    </div>
  );
}
