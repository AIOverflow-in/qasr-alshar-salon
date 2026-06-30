"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Printer, Download, ChevronLeft, ChevronRight, Receipt, Coins, CreditCard, ArrowLeftRight, Pencil } from "lucide-react";
import { cn, aed } from "@/lib/utils";
import { BillDetailModal } from "@/components/erp/BillDetailModal";

export type SalesLine = { description: string; qty: number; unitAED: number; lineAED: number; kind: string; artists: string[] };
export type SalesBooking = { whenLabel: string; source: string; serviceMode: string | null; address: string | null; customRequest: string | null; notes: string | null };

export type SalesRow = {
  id: string;
  invoiceNo: string;
  createdAt: string; // ISO
  client: string;
  items: string[];
  artist: string;
  artists: string[];
  lines: SalesLine[];
  payment: "CASH" | "CARD" | "TRANSFER";
  net: number;
  vat: number;
  total: number;
  cashier?: string | null;
  notes?: string | null;
  booking?: SalesBooking | null;
};

type Summary = { count: number; total: number; net: number; vat: number; byMethod: { CASH: number; CARD: number; TRANSFER: number } };

const PAGE_SIZE = 20;

const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", hour: "numeric", minute: "2-digit", hour12: true });
const dateFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", day: "2-digit", month: "short" });
const todayDubai = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const PAY_BADGE: Record<SalesRow["payment"], string> = {
  CASH: "border-green-500/40 bg-green-500/10 text-green-400",
  CARD: "border-gold/40 bg-gold/10 text-gold",
  TRANSFER: "border-blue-400/40 bg-blue-400/10 text-blue-300",
};

const CHIPS: { key: string; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "3m", label: "Last 3 months" },
];

export function SalesTable({
  rows,
  summary,
  activeRange,
  activeDate,
  activeFrom,
  activeTo,
  capped,
  canEdit = false,
}: {
  rows: SalesRow[];
  summary: Summary;
  activeRange: string;
  activeDate: string | null;
  activeFrom: string | null;
  activeTo: string | null;
  capped: boolean;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [payment, setPayment] = useState<"ALL" | SalesRow["payment"]>("ALL");
  const [page, setPage] = useState(0);
  const [from, setFrom] = useState(activeFrom ?? "");
  const [to, setTo] = useState(activeTo ?? "");
  const [detailRow, setDetailRow] = useState<SalesRow | null>(null);

  const isCustom = activeRange === "custom";
  const showDate = activeRange !== "today" && activeRange !== "yesterday" && activeRange !== "date";

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (payment !== "ALL" && r.payment !== payment) return false;
      if (!query) return true;
      return (
        r.client.toLowerCase().includes(query) ||
        r.invoiceNo.toLowerCase().includes(query) ||
        r.artist.toLowerCase().includes(query)
      );
    });
  }, [rows, q, payment]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  function go(params: string) { router.push(`/erp/sales?${params}`); }
  function reset(setter: () => void) { setter(); setPage(0); }
  function applyCustom() { if (from && to) go(`from=${from}&to=${to}`); }

  const exportQs = isCustom && activeFrom && activeTo
    ? `from=${activeFrom}&to=${activeTo}`
    : activeDate ? `date=${activeDate}` : `range=${activeRange === "date" || activeRange === "custom" ? "today" : activeRange}`;

  const isChipActive = (key: string) => !isCustom && !activeDate && (activeRange === key);

  return (
    <div className="space-y-5">
      {/* period selector */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {CHIPS.map((c) => (
            <button
              key={c.key}
              onClick={() => go(`range=${c.key}`)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm transition-colors",
                isChipActive(c.key) ? "border-gold bg-gold/15 text-gold" : "border-ink-line text-sand hover:border-gold/50"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-muted">Custom range</span>
          <input
            type="date" value={from} max={to || todayDubai()}
            onChange={(e) => setFrom(e.target.value)}
            className={cn("rounded-lg border bg-ink-card px-3 py-1.5 text-sm text-cream outline-none focus:border-gold/60 [color-scheme:dark]", isCustom ? "border-gold/50" : "border-ink-line")}
          />
          <span className="text-muted">–</span>
          <input
            type="date" value={to} min={from} max={todayDubai()}
            onChange={(e) => setTo(e.target.value)}
            className={cn("rounded-lg border bg-ink-card px-3 py-1.5 text-sm text-cream outline-none focus:border-gold/60 [color-scheme:dark]", isCustom ? "border-gold/50" : "border-ink-line")}
          />
          <button
            onClick={applyCustom}
            disabled={!from || !to}
            className="rounded-lg bg-gold-gradient px-4 py-1.5 text-sm font-semibold text-espresso disabled:opacity-40"
          >
            Apply
          </button>
          <a
            href={`/api/erp/sales/export?${exportQs}`}
            className="ml-auto inline-flex items-center gap-2 rounded-full border border-ink-line px-4 py-1.5 text-sm text-sand hover:border-gold/50 hover:text-gold"
          >
            <Download size={15} /> Export CSV
          </a>
        </div>
      </div>

      {/* summary cards — accurate for the whole selected period */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="surface rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider text-muted">Takings</div>
          <div className="mt-1 font-display text-3xl text-gold-gradient">{aed(summary.total)}</div>
          <div className="mt-1 text-xs text-muted">{aed(summary.net)} net · {aed(summary.vat)} VAT</div>
        </div>
        <div className="surface rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider text-muted">Bills</div>
          <div className="mt-1 font-display text-3xl text-cream">{summary.count}</div>
          <div className="mt-1 text-xs text-muted">in this period</div>
        </div>
        <div className="surface rounded-2xl p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted"><Coins size={13} /> Cash</div>
          <div className="mt-1 font-display text-2xl text-cream">{aed(summary.byMethod.CASH)}</div>
        </div>
        <div className="surface rounded-2xl p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted"><CreditCard size={13} /> Card / <ArrowLeftRight size={13} /> Transfer</div>
          <div className="mt-1 font-display text-2xl text-cream">{aed(summary.byMethod.CARD)} <span className="text-sm text-muted">/ {aed(summary.byMethod.TRANSFER)}</span></div>
        </div>
      </div>

      {/* controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => reset(() => setQ(e.target.value))}
            placeholder="Search client, invoice # or artist…"
            className="w-full rounded-full border border-ink-line bg-ink-card py-2 pl-9 pr-4 text-sm text-cream placeholder:text-muted outline-none focus:border-gold/60"
          />
        </div>
        <div className="flex gap-1">
          {(["ALL", "CASH", "CARD", "TRANSFER"] as const).map((p) => (
            <button
              key={p}
              onClick={() => reset(() => setPayment(p))}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                payment === p ? "border-gold bg-gold/15 text-gold" : "border-ink-line text-muted hover:border-gold/40"
              )}
            >
              {p === "ALL" ? "All" : p.toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {capped && (
        <p className="rounded-lg border border-gold/25 bg-gold/5 px-4 py-2 text-xs text-gold">
          Showing the most recent {rows.length} bills in the table — the totals above cover all {summary.count} bills in this period. Narrow the range to see older ones.
        </p>
      )}

      {/* table */}
      <div className="surface overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-ink-line text-left text-muted">
            <tr>
              <th className="p-4 font-medium">When</th>
              <th className="p-4 font-medium">Invoice</th>
              <th className="p-4 font-medium">Client</th>
              <th className="p-4 font-medium">Items</th>
              <th className="p-4 font-medium">Artist</th>
              <th className="p-4 font-medium">Payment</th>
              <th className="p-4 text-right font-medium">Total</th>
              <th className="p-4 text-right font-medium">Receipt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-line/60">
            {pageRows.map((r) => {
              const d = new Date(r.createdAt);
              const itemSummary = r.items.length <= 1 ? (r.items[0] ?? "—") : `${r.items[0]} +${r.items.length - 1}`;
              const artistLabel = r.artists.length === 0
                ? r.artist
                : r.artists.length <= 2 ? r.artists.join(", ") : `${r.artists[0]} +${r.artists.length - 1}`;
              return (
                <tr key={r.id} onClick={() => setDetailRow(r)} className="cursor-pointer transition-colors hover:bg-gold/5" title="View bill details">
                  <td className="whitespace-nowrap p-4 text-gold">
                    {timeFmt.format(d)}
                    {showDate && <div className="text-xs text-muted">{dateFmt.format(d)}</div>}
                  </td>
                  <td className="whitespace-nowrap p-4 font-mono text-xs text-sand">{r.invoiceNo}</td>
                  <td className="p-4 text-cream">
                    {r.client}
                    {r.cashier && <div className="text-[0.65rem] text-muted">rung up by {r.cashier}</div>}
                  </td>
                  <td className="max-w-[220px] truncate p-4 text-sand" title={r.items.join(", ")}>{itemSummary}</td>
                  <td className="whitespace-nowrap p-4 text-sand" title={r.artists.join(", ")}>{artistLabel}</td>
                  <td className="p-4">
                    <span className={cn("rounded-full border px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide", PAY_BADGE[r.payment])}>
                      {r.payment}
                    </span>
                  </td>
                  <td className="whitespace-nowrap p-4 text-right font-semibold tabular-nums text-cream">{aed(r.total)}</td>
                  <td className="whitespace-nowrap p-4 text-right">
                    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {canEdit && (
                        <Link
                          href={`/erp/pos?orderId=${r.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-ink-line px-2.5 py-1.5 text-xs text-sand hover:border-gold/50 hover:text-gold"
                          title="Edit this bill — payment method, amount or services"
                        >
                          <Pencil size={13} /> Edit
                        </Link>
                      )}
                      <a
                        href={`/api/erp/invoice/${r.invoiceNo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-gold/40 px-2.5 py-1.5 text-xs text-gold hover:bg-gold/10"
                        title="View / print receipt"
                      >
                        <Printer size={13} /> PDF
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="p-12 text-center text-muted">
                  <Receipt size={28} className="mx-auto mb-3 text-ink-line" />
                  No bills {q || payment !== "ALL" ? "match your filters" : "in this period"}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">
            Showing {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          {pages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                className="grid h-8 w-8 place-items-center rounded-lg border border-ink-line text-sand hover:border-gold/50 disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs text-muted">Page {safePage + 1} of {pages}</span>
              <button
                onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
                disabled={safePage >= pages - 1}
                className="grid h-8 w-8 place-items-center rounded-lg border border-ink-line text-sand hover:border-gold/50 disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {detailRow && <BillDetailModal row={detailRow} canEdit={canEdit} onClose={() => setDetailRow(null)} />}
    </div>
  );
}
