import Link from "next/link";
import { Trophy, TrendingUp, TrendingDown, ChevronRight, Crown } from "lucide-react";
import { aed, cn } from "@/lib/utils";
import type { PerfSummary } from "@/lib/performance-core";

/**
 * Ranked team performance — built so Jacqueline can show an artist their real numbers.
 *
 * Design intent: the top performer is the thing people come here to see, so they get a spotlight
 * rather than being row 1 of a flat list. The rest of the team reads underneath as a compact
 * ranking. Nothing here needs explaining before it can be understood.
 */
export function TeamPerformance({ data, monthLabel }: { data: PerfSummary; monthLabel: string }) {
  if (data.rows.length === 0) return null;

  const [first, ...rest] = data.rows;
  const top = first.revenueAED || 1;
  const medal = ["text-sand", "text-[#b08d57]"]; // 2nd, 3rd (1st is in the spotlight)

  return (
    <section className="surface overflow-hidden rounded-2xl">
      {/* Header */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink-line px-6 py-4">
        <h2 className="flex items-center gap-2 font-display text-xl text-cream">
          <Trophy size={18} className="text-gold" /> Team performance
        </h2>
        <span className="text-xs text-muted">{monthLabel} · {data.activeCount} artists</span>
      </div>

      {/* Top performer — the headline */}
      <div className="border-b border-ink-line bg-gold/5 px-6 py-5">
        <Link href={`/erp/staff/${first.staffId}`} className="group block">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-gold/50 bg-gold/10">
              <Crown size={20} className="text-gold" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-[0.65rem] uppercase tracking-widest text-gold">Top performer</div>
              <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3">
                <span className="truncate font-display text-2xl text-cream group-hover:text-gold">{first.name}</span>
                <span className="text-xs text-muted">{first.role}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                <span>{first.clientsServed} client{first.clientsServed === 1 ? "" : "s"}</span>
                <span aria-hidden>·</span>
                <span>{aed(first.perClientAED)} each</span>
                <span aria-hidden>·</span>
                <span>{first.sharePct}% of team revenue</span>
                {first.vsAveragePct > 0 && (
                  <span className="inline-flex items-center gap-0.5 font-semibold text-green-500">
                    <TrendingUp size={11} /> +{first.vsAveragePct}% vs average
                  </span>
                )}
              </div>
            </div>

            <div className="text-right">
              <div className="font-display text-3xl text-gold-gradient">{aed(first.revenueAED)}</div>
              <div className="text-[0.6rem] uppercase tracking-wider text-muted">brought in</div>
            </div>
          </div>
        </Link>
      </div>

      {/* Team totals, for context under the winner */}
      <div className="grid grid-cols-3 divide-x divide-ink-line border-b border-ink-line text-center">
        <div className="px-4 py-3">
          <div className="font-display text-lg text-cream">{aed(data.totalRevenueAED)}</div>
          <div className="text-[0.6rem] uppercase tracking-wider text-muted">Team revenue</div>
        </div>
        <div className="px-4 py-3">
          <div className="font-display text-lg text-cream">{data.totalClients.toLocaleString("en-AE")}</div>
          <div className="text-[0.6rem] uppercase tracking-wider text-muted">Clients served</div>
        </div>
        <div className="px-4 py-3">
          <div className="font-display text-lg text-cream">{aed(data.averageRevenueAED)}</div>
          <div className="text-[0.6rem] uppercase tracking-wider text-muted">Average artist</div>
        </div>
      </div>

      {/* Everyone else */}
      {rest.length > 0 && (
        <ol className="divide-y divide-ink-line/60">
          {rest.map((r) => {
            const behind = r.vsAveragePct < 0;
            return (
              <li key={r.staffId}>
                <Link href={`/erp/staff/${r.staffId}`} className="block px-6 py-3.5 transition-colors hover:bg-gold/5">
                  <div className="flex items-center gap-4">
                    <span className={cn("w-6 shrink-0 text-center font-display text-base", medal[r.rank - 2] ?? "text-muted")}>
                      {r.rank}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <span className="truncate text-sm font-semibold text-cream">{r.name}</span>
                        <span className="font-display text-base text-cream">{aed(r.revenueAED)}</span>
                      </div>

                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink">
                        <div
                          className="h-full rounded-full bg-gold/50"
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
                          className={cn("inline-flex items-center gap-0.5 font-semibold", behind ? "text-red-500" : "text-green-500")}
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
      )}

      <p className="border-t border-ink-line px-6 py-3 text-[0.65rem] text-muted">
        Revenue is what each artist personally brought in — a shared service is split between them, the same way commission is paid.
        Tap anyone for their full history.
      </p>
    </section>
  );
}
