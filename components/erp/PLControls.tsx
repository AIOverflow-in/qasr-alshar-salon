"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileDown, FileSpreadsheet, CalendarRange } from "lucide-react";

const TABS: { key: string; label: string }[] = [
  { key: "month", label: "This month" },
  { key: "lastmonth", label: "Last month" },
  { key: "year", label: "Year to date" },
  { key: "ct", label: "Tax period" },
];

/** P&L period tabs + custom range + PDF/CSV download. Keeps the URL as the single source of truth. */
export function PLControls({ period, from, to, pdfHref, csvHref }: { period: string; from: string; to: string; pdfHref: string; csvHref: string }) {
  const router = useRouter();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);

  const go = (p: string) => router.push(`/erp/finance/pl?period=${p}`);
  const goCustom = () => { if (f && t) router.push(`/erp/finance/pl?period=custom&from=${f}&to=${t}`); };

  return (
    <div className="surface rounded-2xl p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => go(tab.key)}
            className={`rounded-full px-4 py-1.5 text-sm transition ${period === tab.key ? "bg-gold-gradient font-semibold text-espresso" : "border border-ink-line text-sand hover:text-gold"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 border-t border-ink-line pt-4">
        <div className="flex items-end gap-2">
          <CalendarRange size={16} className="mb-2 text-gold" />
          <label className="text-xs text-muted">
            From
            <input type="date" value={f} onChange={(e) => setF(e.target.value)} className="mt-1 block rounded-lg border border-ink-line bg-ink-card px-2 py-1.5 text-sm text-cream outline-none focus:border-gold/60" />
          </label>
          <label className="text-xs text-muted">
            To
            <input type="date" value={t} onChange={(e) => setT(e.target.value)} className="mt-1 block rounded-lg border border-ink-line bg-ink-card px-2 py-1.5 text-sm text-cream outline-none focus:border-gold/60" />
          </label>
          <button onClick={goCustom} className={`rounded-full px-4 py-1.5 text-sm transition ${period === "custom" ? "bg-gold-gradient font-semibold text-espresso" : "border border-gold/40 text-gold hover:bg-gold/10"}`}>
            Apply
          </button>
        </div>

        <div className="ml-auto flex flex-wrap gap-2">
          <a href={pdfHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-gold-gradient px-4 py-1.5 text-sm font-semibold text-espresso">
            <FileDown size={15} /> Download PDF
          </a>
          <a href={csvHref} className="inline-flex items-center gap-2 rounded-full border border-gold/40 px-4 py-1.5 text-sm text-gold hover:bg-gold/10">
            <FileSpreadsheet size={15} /> Export CSV
          </a>
        </div>
      </div>
    </div>
  );
}
