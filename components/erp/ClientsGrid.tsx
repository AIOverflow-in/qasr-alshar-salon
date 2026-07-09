"use client";

import { useSearchParams } from "next/navigation";
import { Phone, Mail } from "lucide-react";
import { aed } from "@/lib/utils";
import { ClientsManager } from "@/app/erp/clients/ClientsManager";
import { SearchBox } from "@/components/erp/SearchBox";
import { Pagination } from "@/components/erp/Pagination";

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

function fmt(iso: string) {
  return new Intl.DateTimeFormat("en-AE", { day: "numeric", month: "short", timeZone: "Asia/Dubai" }).format(new Date(iso));
}

export function ClientsGrid({ clients, total, page, size }: { clients: ClientCard[]; total: number; page: number; size: number }) {
  const sp = useSearchParams();
  const q = sp?.get("q") ?? "";

  return (
    <div className="space-y-4">
      <SearchBox placeholder="Search by name, phone or email…" className="max-w-md" />

      {total === 0 ? (
        <div className="surface rounded-2xl p-10 text-center text-muted">{q ? `No clients match “${q}”.` : "No clients yet."}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => (
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

      <Pagination total={total} page={page} size={size} />
    </div>
  );
}
