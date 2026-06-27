"use client";

import { useState, useMemo } from "react";
import { Search, ChevronLeft, ChevronRight, Phone, Mail } from "lucide-react";
import { aed } from "@/lib/utils";
import { ClientsManager } from "@/app/erp/clients/ClientsManager";

type Order = { invoiceNo: string; totalAED: number; createdAt: string };
export type ClientCard = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  hairType: string | null;
  notes: string | null;
  visits: number;
  totalSpentAED: number;
  consentMarketing: boolean;
  salesOrders: Order[];
};

const PAGE = 12;

function fmt(iso: string) {
  return new Intl.DateTimeFormat("en-AE", { day: "numeric", month: "short", timeZone: "Asia/Dubai" }).format(new Date(iso));
}

export function ClientsGrid({ clients }: { clients: ClientCard[] }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return clients;
    return clients.filter(
      (c) => c.name.toLowerCase().includes(s) || (c.phone ?? "").includes(s) || (c.email ?? "").toLowerCase().includes(s)
    );
  }, [clients, q]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, pages - 1);
  const slice = filtered.slice(safePage * PAGE, safePage * PAGE + PAGE);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(0); }}
          placeholder="Search by name, phone or email…"
          className="w-full rounded-full border border-ink-line bg-ink-card py-2.5 pl-10 pr-4 text-sm text-cream placeholder:text-muted outline-none focus:border-gold/60"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="surface rounded-2xl p-10 text-center text-muted">No clients match “{q}”.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {slice.map((c) => (
            <div key={c.id} className="surface flex flex-col rounded-2xl p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-cream">{c.name}</div>
                  <div className="mt-1 space-y-0.5 text-xs text-muted">
                    {c.phone && <div className="flex items-center gap-1.5"><Phone size={11} /> {c.phone}</div>}
                    {c.email && <div className="flex items-center gap-1.5"><Mail size={11} /> <span className="truncate">{c.email}</span></div>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-3 text-center">
                  <div>
                    <div className="font-display text-lg text-gold">{c.visits}</div>
                    <div className="text-[0.6rem] uppercase tracking-wide text-muted">visits</div>
                  </div>
                  <div>
                    <div className="font-display text-lg text-gold">{aed(c.totalSpentAED)}</div>
                    <div className="text-[0.6rem] uppercase tracking-wide text-muted">spent</div>
                  </div>
                </div>
              </div>

              {(c.hairType || c.notes) && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {c.hairType && <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-xs text-gold">{c.hairType}</span>}
                  {c.notes && <span className="truncate text-xs italic text-muted">{c.notes}</span>}
                </div>
              )}

              {c.salesOrders.length > 0 && (
                <div className="mt-3 border-t border-ink-line/50 pt-2.5 text-xs text-muted">
                  <span className="text-muted">Last visit: </span>
                  <span className="text-sand">{c.salesOrders[0].invoiceNo} · {aed(c.salesOrders[0].totalAED)} · {fmt(c.salesOrders[0].createdAt)}</span>
                </div>
              )}

              <div className="mt-auto flex justify-end pt-3">
                <ClientsManager
                  editClient={{
                    id: c.id, name: c.name, phone: c.phone ?? "", email: c.email ?? "",
                    hairType: c.hairType ?? "", notes: c.notes ?? "", consentMarketing: c.consentMarketing,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <p className="text-sm text-muted">{filtered.length} client{filtered.length !== 1 ? "s" : ""}</p>
        {pages > 1 && (
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0} className="grid h-8 w-8 place-items-center rounded-lg border border-ink-line text-sand disabled:opacity-40 hover:border-gold/50" aria-label="Previous page"><ChevronLeft size={16} /></button>
            <span className="text-xs text-muted">Page {safePage + 1} of {pages}</span>
            <button onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={safePage >= pages - 1} className="grid h-8 w-8 place-items-center rounded-lg border border-ink-line text-sand disabled:opacity-40 hover:border-gold/50" aria-label="Next page"><ChevronRight size={16} /></button>
          </div>
        )}
      </div>
    </div>
  );
}
