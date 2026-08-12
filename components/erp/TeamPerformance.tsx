import { Trophy, TrendingUp, TrendingDown } from "lucide-react";
import { aed, cn } from "@/lib/utils";
import type { PerfSummary } from "@/lib/performance-core";

/**
 * Ranked team performance for the selected month — built so an artist can be shown their real
 * numbers next to the team, rather than the conversation being a matter of opinion.
 */
export function TeamPerformance({ data, monthLabel }: { data: PerfSummary; monthLabel: string }) {
  if (data.rows.length === 0) return null;
  const top = data.rows[0].revenueAED || 1;

  return (
    <section className="surface rounded-2xl p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-xl text-cream">
          <Trophy size={18} className="text-gold" /> Team performance
        </h2>
        <p className="text-xs text-muted">{monthLabel} · {data.activeCount} artists · {data.totalClients} clients · {aed(data.totalRevenueAED)}</p>
      </div>
      <p className="mt-1 text-xs text-muted">Ranked by the money each artist brought in. Team average is {aed(data.averageRevenueAED)}.</p>

      <div className="mt-4 space-y-2">
        {data.rows.map((r) => {
          const behind = r.vsAveragePct < 0;
          return (
            <div key={r.staffId} className="rounded-xl border border-ink-line p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="flex items-baseline gap-2">
                  <span className={cn("font-display text-sm", r.rank === 1 ? "text-gold" : "text-muted")}>#{r.rank}</span>
                  <span className="text-sm text-cream">{r.name}</span>
                </span>
                <span className="text-sm tabular-nums text-cream">
                  {aed(r.revenueAED)}
                  <span className="ml-1.5 text-xs text-muted">{r.sharePct}% of team</span>
                </span>
              </div>

              <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink">
                <div className="h-full rounded-full bg-gold" style={{ width: `${Math.max(2, Math.round((r.revenueAED / top) * 100))}%` }} />
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[0.65rem] text-muted">
                <span>{r.clientsServed} client{r.clientsServed === 1 ? "" : "s"}</span>
                <span>{aed(r.perClientAED)} per client</span>
                <span className={cn("inline-flex items-center gap-1", behind ? "text-red-600" : "text-green-600")}>
                  {behind ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
                  {behind ? "" : "+"}{r.vsAveragePct}% vs team average
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
