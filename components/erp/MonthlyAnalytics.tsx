"use client";

import { useState } from "react";
import { aed } from "@/lib/utils";
import type { MonthlyAnalytics as Data } from "@/lib/analytics";

const TABS = ["Crown Dial", "Ascent", "Build-Up", "Heat-Calendar", "Payment Mix", "Weekday"] as const;
type Tab = (typeof TABS)[number];

// Gold intensity for the heat calendar (dark theme: faint → bright gold).
const goldAlpha = (frac: number) => `rgba(201,162,76,${(0.10 + 0.9 * frac).toFixed(3)})`;
const GRAD = "linear-gradient(90deg,#8a6a22,#c9a24c 55%,#e6c877)";

export function MonthlyAnalytics({ data }: { data: Data }) {
  const [tab, setTab] = useState<Tab>("Heat-Calendar");
  const pct = data.target > 0 ? Math.min(100, Math.round((data.total / data.target) * 100)) : 0;

  return (
    <div className="surface rounded-2xl p-6">
      {/* header — same "This Month" number as before, now the analytics hub */}
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-2xl text-cream">This Month</h2>
        <span className="text-sm text-muted">Target {aed(data.target)}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-end gap-3">
        <span className="font-display text-4xl text-gold-gradient sm:text-5xl">{aed(data.total)}</span>
        <span className="pb-1 text-sm text-muted">{pct}% of monthly goal</span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink-card">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: GRAD }} />
      </div>
      <p className="mt-3 text-sm text-muted">
        {data.count} paid invoice{data.count === 1 ? "" : "s"} this month · {aed(data.net)} net + {aed(data.vat)} VAT. Every POS bill updates this in real time.
      </p>

      {/* tabs */}
      <div className="mt-5 flex flex-wrap gap-1 rounded-full border border-ink-line bg-ink-card/50 p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${tab === t ? "bg-gold/15 text-gold" : "text-muted hover:text-cream"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-5 border-t border-ink-line/60 pt-5">
        {tab === "Crown Dial" && <CrownDial d={data} pct={pct} />}
        {tab === "Ascent" && <Ascent d={data} />}
        {tab === "Build-Up" && <BuildUp d={data} />}
        {tab === "Heat-Calendar" && <HeatCalendar d={data} />}
        {tab === "Payment Mix" && <PaymentMix d={data} />}
        {tab === "Weekday" && <Weekday d={data} />}
      </div>
    </div>
  );
}

function Caption({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-4">
      <div className="font-display text-lg text-cream">{title}</div>
      <div className="text-xs text-muted">{sub}</div>
    </div>
  );
}

function Footer({ items }: { items: [string, string][] }) {
  return (
    <div className="mt-6 grid grid-cols-3 gap-3 border-t border-ink-line/60 pt-4">
      {items.map(([v, k], i) => (
        <div key={k}>
          <div className={`font-display text-xl ${i === 0 ? "text-gold-gradient" : "text-cream"}`}>{v}</div>
          <div className="text-[0.6rem] uppercase tracking-wider text-muted">{k}</div>
        </div>
      ))}
    </div>
  );
}

function CrownDial({ d, pct }: { d: Data; pct: number }) {
  const R = 80, L = Math.PI * R;
  return (
    <div>
      <Caption title="Crown Dial" sub="This month's takings against your monthly goal." />
      <div className="grid place-items-center py-2">
        <svg viewBox="0 0 200 118" className="w-full max-w-sm">
          <defs>
            <linearGradient id="dial" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#8a6a22" /><stop offset="0.55" stopColor="#c9a24c" /><stop offset="1" stopColor="#e6c877" />
            </linearGradient>
          </defs>
          <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="rgba(201,162,76,0.14)" strokeWidth="15" strokeLinecap="round" />
          <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="url(#dial)" strokeWidth="15" strokeLinecap="round" strokeDasharray={`${(pct / 100) * L} ${L}`} />
          <text x="100" y="86" textAnchor="middle" className="fill-cream" style={{ font: "700 22px var(--font-display, serif)" }}>{pct}%</text>
          <text x="100" y="104" textAnchor="middle" className="fill-[color:var(--muted,#9a8f73)]" style={{ font: "10px sans-serif" }}>of goal</text>
        </svg>
      </div>
      <Footer items={[[aed(d.total), "Taken"], [aed(Math.max(0, d.target - d.total)), "To goal"], [aed(d.avgActiveDay), "Avg / active day"]]} />
    </div>
  );
}

function Ascent({ d }: { d: Data }) {
  const upto = d.byDay.slice(0, Math.max(1, d.todayDom));
  let run = 0;
  const cum = upto.map((x) => ({ day: x.day, v: (run += x.amount) }));
  const maxV = Math.max(1, cum[cum.length - 1]?.v ?? 0);
  const W = 320, H = 150, n = Math.max(2, d.daysInMonth);
  const x = (day: number) => ((day - 1) / (n - 1)) * W;
  const y = (v: number) => H - (v / maxV) * H;
  const line = cum.map((p) => `${x(p.day).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const area = `0,${H} ${line} ${x(cum[cum.length - 1]?.day ?? 1).toFixed(1)},${H}`;
  const best = d.byDay.reduce((m, x2) => Math.max(m, x2.amount), 0);
  return (
    <div>
      <Caption title="Ascent" sub="Takings adding up through the month, day by day." />
      <svg viewBox={`0 0 ${W} ${H + 6}`} className="w-full" preserveAspectRatio="none" style={{ height: 170 }}>
        <defs>
          <linearGradient id="asc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="rgba(201,162,76,0.35)" /><stop offset="1" stopColor="rgba(201,162,76,0)" /></linearGradient>
        </defs>
        <polygon points={area} fill="url(#asc)" />
        <polyline points={line} fill="none" stroke="#c9a24c" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <Footer items={[[aed(d.total), "Total so far"], [aed(best), "Best single day"], [`${d.daysTraded} / ${d.daysInMonth}`, "Days traded"]]} />
    </div>
  );
}

function BuildUp({ d }: { d: Data }) {
  const cats = d.byCategory.slice(0, 6);
  const sum = cats.reduce((s, c) => s + c.amount, 0) || 1;
  const H = 190;
  let acc = 0;
  return (
    <div>
      <Caption title="Revenue Build-Up" sub="Where it came from — each service category stacks toward the total." />
      <div className="flex items-end gap-2 overflow-x-auto pb-1" style={{ height: H + 46 }}>
        {cats.map((c) => {
          const h = (c.amount / sum) * H;
          const bottom = (acc / sum) * H;
          acc += c.amount;
          return (
            <div key={c.name} className="flex min-w-[70px] flex-1 flex-col items-center justify-end" style={{ height: H + 40 }}>
              <div className="mb-1 text-xs font-semibold text-gold">+{c.amount.toLocaleString("en-AE")}</div>
              <div className="w-full rounded-md" style={{ height: Math.max(6, h), marginBottom: bottom, background: GRAD }} />
              <div className="mt-2 h-8 text-center text-[0.65rem] leading-tight text-muted">{c.name}</div>
            </div>
          );
        })}
        <div className="flex min-w-[70px] flex-1 flex-col items-center justify-end" style={{ height: H + 40 }}>
          <div className="mb-1 text-xs font-semibold text-cream">{sum.toLocaleString("en-AE")}</div>
          <div className="w-full rounded-md bg-espresso" style={{ height: H }} />
          <div className="mt-2 h-8 text-center text-[0.65rem] font-semibold leading-tight text-cream">Total</div>
        </div>
      </div>
      <Footer items={[[d.topCategory.name, "Top driver"], [String(cats.length), "Categories"], [aed(sum), "Total (ex-VAT)"]]} />
    </div>
  );
}

function HeatCalendar({ d }: { d: Data }) {
  const max = Math.max(1, ...d.byDay.map((x) => x.amount));
  const blanks = Array.from({ length: d.firstWeekday });
  return (
    <div>
      <Caption title="Month Heat-Calendar" sub="Every day of the month as a tile — the warmer the gold, the bigger the takings." />
      <div className="grid grid-cols-7 gap-1.5 text-center text-[0.6rem] text-muted">
        {["M", "T", "W", "T", "F", "S", "S"].map((w, i) => <div key={i} className="pb-1">{w}</div>)}
        {blanks.map((_, i) => <div key={`b${i}`} />)}
        {d.byDay.map((x) => (
          <div key={x.day} className="relative aspect-[4/3] rounded-md border border-ink-line/40 p-1 text-left"
            style={{ background: x.amount > 0 ? goldAlpha(x.amount / max) : "rgba(255,255,255,0.02)" }}>
            <span className={`text-[0.6rem] ${x.day === d.todayDom ? "font-bold text-gold" : "text-sand/70"}`}>{x.day}</span>
            {x.amount > 0 && <span className="absolute bottom-1 right-1 text-[0.6rem] font-semibold text-cream">{x.amount}</span>}
          </div>
        ))}
      </div>
      <Footer items={[[aed(d.hottestDay.amount), "Hottest day"], [`${d.daysTraded} / ${d.daysInMonth}`, "Days traded"], [aed(d.avgActiveDay), "Avg / active day"]]} />
    </div>
  );
}

function PaymentMix({ d }: { d: Data }) {
  const rows = [
    { k: "Card", v: d.byMethod.CARD, c: "#8a6a22" },
    { k: "Cash", v: d.byMethod.CASH, c: "#c9a24c" },
    { k: "Transfer", v: d.byMethod.TRANSFER, c: "#e6c877" },
  ];
  const sum = rows.reduce((s, r) => s + r.v, 0) || 1;
  const R = 52, C = 2 * Math.PI * R;
  let off = 0;
  return (
    <div>
      <Caption title="Payment Mix" sub="How this month's cash actually came in — by payment method." />
      <div className="flex flex-wrap items-center justify-center gap-8">
        <svg viewBox="0 0 140 140" className="h-40 w-40 -rotate-90">
          <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="18" />
          {rows.map((r) => {
            const frac = r.v / sum;
            const seg = <circle key={r.k} cx="70" cy="70" r={R} fill="none" stroke={r.c} strokeWidth="18" strokeDasharray={`${frac * C} ${C}`} strokeDashoffset={-off} />;
            off += frac * C;
            return seg;
          })}
        </svg>
        <div className="space-y-2 text-sm">
          {rows.map((r) => (
            <div key={r.k} className="flex items-center gap-3">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: r.c }} />
              <span className="w-16 text-cream">{r.k}</span>
              <span className="w-10 text-right font-semibold text-gold">{Math.round((r.v / sum) * 100)}%</span>
              <span className="w-24 text-right text-muted">{aed(r.v)}</span>
            </div>
          ))}
        </div>
      </div>
      <Footer items={[[`${Math.round((d.byMethod.CARD / sum) * 100)}%`, "On card"], [aed(d.byMethod.CASH), "Cash taken"], [aed(d.byMethod.TRANSFER), "Bank transfer"]]} />
    </div>
  );
}

function Weekday({ d }: { d: Data }) {
  const max = Math.max(1, ...d.byWeekday.map((x) => x.amount));
  return (
    <div>
      <Caption title="Weekday Rhythm" sub="Which days of the week bring the money in — totalled across the month." />
      <div className="space-y-2">
        {d.byWeekday.map((x) => (
          <div key={x.label} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs text-sand">{x.label}</span>
            <div className="h-6 flex-1 overflow-hidden rounded-md bg-ink-card">
              <div className="h-full rounded-md" style={{ width: `${Math.max(2, (x.amount / max) * 100)}%`, background: GRAD }} />
            </div>
            <span className="w-24 shrink-0 text-right text-xs font-semibold text-gold">{aed(x.amount)}</span>
          </div>
        ))}
      </div>
      <Footer items={[[d.strongestWeekday.label, "Strongest day"], [aed(d.strongestWeekday.amount), "Best weekday"], [aed(Math.round(d.byWeekday.reduce((s, x) => s + x.amount, 0) / 7)), "Avg / weekday"]]} />
    </div>
  );
}
