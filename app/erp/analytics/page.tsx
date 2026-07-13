import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { aggregatePageStats, fmtDuration } from "@/lib/web-analytics-core";

export const dynamic = "force-dynamic";

/** Dubai calendar day "YYYY-MM-DD", offset from today (approx; fine for a 30-day window). */
function dubaiDayStr(offsetDays = 0): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(Date.now() + offsetDays * 864e5));
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink-line bg-ink-card p-5">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 font-display text-2xl text-cream">{value}</div>
    </div>
  );
}

export default async function ErpAnalytics() {
  const ok = await requireRole(["SUPER_ADMIN", "ADMIN"]);
  if (!ok) redirect("/erp");

  const cutoff = dubaiDayStr(-29);
  const rows = await prisma.pageStat.findMany({
    where: { day: { gte: cutoff } },
    select: { day: true, path: true, views: true, engagedSec: true },
  });
  const s = aggregatePageStats(rows, { limit: 20 });
  const maxDay = Math.max(1, ...s.byDay.map((d) => d.views));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl text-gold-gradient">Web Analytics</h1>
        <p className="mt-1 text-sm text-muted">How visitors use the public website — last 30 days. Page views and average engaged time (how long people actually stay).</p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-ink-line bg-ink-card p-8 text-center text-muted">
          No visits recorded yet. Data will appear here as people browse the public website.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Tile label="Page views (30d)" value={s.totalViews.toLocaleString()} />
            <Tile label="Avg time on page" value={fmtDuration(s.avgSec)} />
            <Tile label="Pages tracked" value={String(s.topPages.length)} />
          </div>

          <div className="rounded-2xl border border-ink-line bg-ink-card p-5">
            <h2 className="font-display text-lg text-cream">Daily views</h2>
            <div className="mt-4 flex h-32 items-end gap-1">
              {s.byDay.map((d) => (
                <div key={d.day} className="group flex flex-1 flex-col justify-end" title={`${d.day}: ${d.views} views`}>
                  <div className="rounded-t bg-gold/70 group-hover:bg-gold" style={{ height: `${Math.max(2, Math.round((d.views / maxDay) * 100))}%` }} />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[0.65rem] text-muted">
              <span>{s.byDay[0]?.day}</span>
              <span>{s.byDay[s.byDay.length - 1]?.day}</span>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-ink-line bg-ink-card">
            <h2 className="border-b border-ink-line px-5 py-4 font-display text-lg text-cream">Top pages</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-5 py-3 font-medium">Page</th>
                    <th className="px-5 py-3 text-right font-medium">Views</th>
                    <th className="px-5 py-3 text-right font-medium">Avg time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-line/60">
                  {s.topPages.map((p) => (
                    <tr key={p.path} className="hover:bg-gold/5">
                      <td className="px-5 py-3 text-cream">{p.path}</td>
                      <td className="px-5 py-3 text-right text-sand">{p.views.toLocaleString()}</td>
                      <td className="px-5 py-3 text-right text-sand">{fmtDuration(p.avgSec)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
