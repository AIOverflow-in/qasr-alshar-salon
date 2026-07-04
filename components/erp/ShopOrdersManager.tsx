"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aed, cn } from "@/lib/utils";

type Item = { productId: string; name: string; priceAED: number; qty: number; lineAED: number };
type Order = {
  id: string; ref: string; customerName: string; phone: string; email: string | null;
  address: string; emirate: string | null; items: Item[]; itemCount: number; totalAED: number;
  status: string; createdAt: string;
};

const STATUSES = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"];
const STATUS_CLR: Record<string, string> = {
  PENDING: "text-gold", CONFIRMED: "text-blue-300", SHIPPED: "text-sand", DELIVERED: "text-green-400", CANCELLED: "text-red-400",
};

export function ShopOrdersManager({ orders, canEdit }: { orders: Order[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);

  function setStatus(id: string, status: string) {
    start(async () => {
      await fetch(`/api/erp/shop-orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      router.refresh();
    });
  }

  const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));

  return (
    <div className="surface rounded-2xl p-5">
      <div className="mb-3 text-sm text-muted">{orders.length} order{orders.length === 1 ? "" : "s"} · cash on delivery</div>
      <div className={cn("divide-y divide-ink-line/60", pending && "opacity-60")}>
        {orders.length === 0 && <p className="py-10 text-center text-sm text-muted">No shop orders yet.</p>}
        {orders.map((o) => (
          <div key={o.id} className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="font-mono text-xs text-gold">{o.ref}</span>
                <span className="ml-2 text-cream">{o.customerName}</span>
                <span className="ml-2 text-xs text-muted">{o.itemCount} item{o.itemCount === 1 ? "" : "s"} · {fmt(o.createdAt)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-cream">{aed(o.totalAED)}</span>
                {canEdit ? (
                  <select value={o.status} onChange={(e) => setStatus(o.id, e.target.value)} disabled={pending}
                    className={cn("rounded-lg border border-ink-line bg-ink-card px-2 py-1 text-xs outline-none focus:border-gold/60", STATUS_CLR[o.status])}>
                    {STATUSES.map((s) => <option key={s} value={s} className="bg-ink text-cream">{s[0] + s.slice(1).toLowerCase()}</option>)}
                  </select>
                ) : (
                  <span className={cn("text-xs font-semibold", STATUS_CLR[o.status])}>{o.status}</span>
                )}
                <button onClick={() => setOpenId(openId === o.id ? null : o.id)} className="text-xs text-gold hover:underline">{openId === o.id ? "Hide" : "Details"}</button>
              </div>
            </div>
            {openId === o.id && (
              <div className="mt-2 rounded-xl border border-ink-line/60 p-3 text-xs">
                <div className="text-sand">
                  <a href={`tel:${o.phone}`} className="hover:text-gold">{o.phone}</a>
                  {o.email ? <> · <a href={`mailto:${o.email}`} className="hover:text-gold">{o.email}</a></> : null}
                </div>
                <div className="mt-1 text-muted">Deliver to: <span className="text-cream">{o.address}{o.emirate ? `, ${o.emirate}` : ""}</span></div>
                <ul className="mt-2 divide-y divide-ink-line/40">
                  {o.items.map((it, i) => (
                    <li key={i} className="flex justify-between py-1"><span className="text-cream">{it.name} <span className="text-muted">× {it.qty}</span></span><span className="tabular-nums text-gold">{aed(it.lineAED)}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
