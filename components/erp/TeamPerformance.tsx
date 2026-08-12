import Link from "next/link";
import { Trophy, TrendingUp, TrendingDown, Users, Wallet, Target, ChevronRight } from "lucide-react";
import { aed, cn } from "@/lib/utils";
import type { PerfSummary } from "@/lib/performance-core";

/**
 * Ranked team performance — built so Jacqueline can show an artist their real numbers.
 *
 * Design intent: professional, but readable at a glance. One headline per artist (what they brought
 * in), one bar to compare them, and the supporting detail kept quiet underneath. Nothing here needs
 * explaining before it can be understood.
 */
export function TeamPerformance({ data, monthLabel }: { data: PerfSummary; monthLabel: string }) {
  if (data.rows.length === 0) return null;
  const top = data.rows[0].revenueAED || 1;
  const medal = ["text-gold", "text-sand", "text-[#b08d57]"]; // 1st, 2nd, 3rd

  const headline = [
    { icon: Wallet, label: "Team revenue", value: aed(data.totalRevenueAED) },
    { icon: Users, label: "Clients served", value: data.totalClients.toLocaleString("en-AE") },
    { icon: Target, label: "Average per artist", value: aed(data.averageRevenueAED) },
  ];

  return (
    <section className="surface overflow-hidden rounded-2xl">
      {/* Header */}
      <div className="border-b border-ink-line px-6 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-xl text-cream">
            <Trophy size={18} className="text-gold" /> Team performance
          </h2>
          <span className="text-xs text-muted">{monthLabel} · {data.activeCount} artists</span>
        </div>
        <p className="mt-1 text-xs text-muted">Who brought in what. Ranked by the money each artist generated.</p>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-3 divide-x divide-ink-line border-b border-ink-line">
        {headline.map((h) => (
          <div key={h.label} className="px-4 py-4 text-center sm:px-6">
            <h.icon size={14} className="mx-auto text-gold" />
            <div className="mt-1.5 font-display text-xl text-cream sm:text-2xl">{h.value}</div>
            <div className="text-[0.6rem] uppercase tracking-wider text-muted sm:text-[0.65rem]">{h.label}</div>
          </div>
        ))}
      </div>

      {/* The ranking */}
      <ol className="divide-y divide-ink-line/60">
        {data.rows.map((r) => {
          const behind = r.vsAveragePct < 0;
          return (
            <li key={r.staffId}>
              <Link href={`/erp/staff/${r.staffId}`} className="block px-6 py-4 transition-colors hover:bg-gold/5">
                <div className="flex items-center gap-4">
                  <span className={cn("w-7 shrink-0 text-center font-display text-lg", medal[r.rank - 1] ?? "text-muted")}>
                    {r.rank}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <span className="truncate text-sm font-semibold text-cream">{r.name}</span>
                      <span className="font-display text-lg text-cream">{aed(r.revenueAED)}</span>
                    </div>

                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink">
                      <div
                        className={cn("h-full rounded-full", r.rank === 1 ? "bg-gold" : "bg-gold/50")}
                        style={{ width: `${Math.max(2, Math.round((r.revenueAED / top) * 100))}%` }}
                      />
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.65rem] text-muted">
                      <span>{r.clientsServed} client{r.clientsServed === 1 ? "" : "s"}</span>
                      <span aria-hidden>·</span>
                      <span>{aed(r.perClientAED)} each</span>
                      <span aria-hidden>·</span>
                      <span>{r.sharePct}% of the team</span>
                      <span
                        className={cn("inline-flex items-center gap-0.5 font-semibold", behind ? "text-red-600" : "text-green-600")}
                        title={`Team average is ${aed(data.averageRevenueAED)}`}
                      >
                        {behind ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
                        {behind ? "" : "+"}{r.vsAveragePct}% vs average
                      </span>
                    </div>
                  </div>

                  <ChevronRight size={15} className="hidden shrink-0 text-muted sm:block" />
                </div>
              </Link>
            </li>
          );
        })}
      </ol>

      <p className="border-t border-ink-line px-6 py-3 text-[0.65rem] text-muted">
        Revenue is what each artist personally brought in — a shared service is split between them, the same way commission is paid.
        Tap anyone for their full history.
      </p>
    </section>
  );
}
