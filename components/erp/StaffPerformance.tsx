import { TrendingUp, Users, Repeat, Wallet, CalendarDays, Scissors } from "lucide-react";
import { aed, cn } from "@/lib/utils";
import type { StaffMetrics } from "@/lib/staff-metrics-core";

/**
 * One artist's performance: a 6-month revenue trend plus the metrics that actually inform a
 * conversation about their numbers — how many clients, how many come back, and what they earn per
 * client. Single-series bars in the house gold; no dual axes.
 */
export function StaffPerformance({ m, teamAverageAED }: { m: StaffMetrics; teamAverageAED?: number }) {
  const max = Math.max(1, ...m.trend.map((t) => t.revenueAED));
  const vsTeam = teamAverageAED && teamAverageAED > 0
    ? Math.round(((m.revenueAED - teamAverageAED) / teamAverageAED) * 100)
    : null;

  const tiles = [
    { icon: Wallet, label: "Revenue brought in", value: aed(m.revenueAED), sub: `${m.visits} service${m.visits === 1 ? "" : "s"} performed` },
    { icon: Users, label: "Clients served", value: String(m.clients), sub: `${aed(m.avgPerClientAED)} per client` },
    { icon: Repeat, label: "Came back", value: `${m.repeatRatePct}%`, sub: `${m.repeatClients} repeat client${m.repeatClients === 1 ? "" : "s"}` },
    { icon: CalendarDays, label: "Busiest day", value: m.busiestDay ?? "—", sub: `${aed(m.avgPerVisitAED)} per service` },
  ];

  return (
    <section className="surface space-y-5 rounded-2xl p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-xl text-cream">
          <TrendingUp size={18} className="text-gold" /> Performance
        </h2>
        {vsTeam !== null && (
          <span className={cn("text-xs", vsTeam < 0 ? "text-red-600" : "text-green-600")}>
            {vsTeam >= 0 ? "+" : ""}{vsTeam}% vs the team average ({aed(teamAverageAED!)})
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-ink-line bg-ink-card p-4">
            <t.icon size={15} className="text-gold" />
            <div className="mt-2 font-display text-2xl text-cream">{t.value}</div>
            <div className="text-[0.65rem] uppercase tracking-wider text-muted">{t.label}</div>
            <div className="mt-0.5 text-xs text-muted">{t.sub}</div>
          </div>
        ))}
      </div>

      {/* Revenue trend */}
      <div className="rounded-xl border border-ink-line p-4">
        <h3 className="text-[0.65rem] uppercase tracking-wider text-muted">Revenue — last {m.trend.length} months</h3>
        <div className="mt-3 flex h-32 items-stretch gap-1.5">
          {m.trend.map((t) => (
            <div key={t.month} className="group flex h-full flex-1 flex-col justify-end" title={`${t.label}: ${aed(t.revenueAED)} · ${t.clients} clients`}>
              <div
                className="rounded-t bg-gold/60 group-hover:bg-gold"
                style={{ height: `${Math.max(2, Math.round((t.revenueAED / max) * 100))}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1.5">
          {m.trend.map((t) => (
            <div key={t.month} className="flex-1 text-center text-[0.6rem] text-muted">{t.label}</div>
          ))}
        </div>
      </div>

      {/* What they actually do */}
      {m.topServices.length > 0 && (
        <div className="rounded-xl border border-ink-line p-4">
          <h3 className="flex items-center gap-1.5 text-[0.65rem] uppercase tracking-wider text-muted">
            <Scissors size={11} /> Top services
          </h3>
          <div className="mt-2.5 space-y-1.5">
            {m.topServices.map((s) => {
              const top = m.topServices[0].revenueAED || 1;
              return (
                <div key={s.name} className="flex items-center gap-2.5 text-xs">
                  <div className="w-40 shrink-0 truncate text-sand" title={s.name}>{s.name}</div>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink">
                    <div className="h-full rounded-full bg-gold/60" style={{ width: `${Math.max(3, Math.round((s.revenueAED / top) * 100))}%` }} />
                  </div>
                  <div className="w-12 shrink-0 text-right text-muted">×{s.times}</div>
                  <div className="w-20 shrink-0 text-right tabular-nums text-cream">{aed(s.revenueAED)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
