"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export type BookingCounts = {
  when: { today: number; tomorrow: number; next2w: number; all: number };
  status: { all: number; confirmed: number; completed: number; cancelled: number; noshow: number };
  source: { all: number; online: number; walkin: number; phone: number; whatsapp: number };
};

const WHEN = [
  { k: "today", label: "Today" },
  { k: "tomorrow", label: "Tomorrow" },
  { k: "next2w", label: "Next 2 weeks" },
  { k: "all", label: "All" },
] as const;
const STATUS = [
  { k: "all", label: "All" },
  { k: "confirmed", label: "Confirmed" },
  { k: "completed", label: "Completed" },
  { k: "cancelled", label: "Cancelled" },
  { k: "noshow", label: "No-show" },
] as const;
const SOURCE = [
  { k: "all", label: "All" },
  { k: "online", label: "Online" },
  { k: "walkin", label: "Walk-in" },
  { k: "phone", label: "Phone" },
  { k: "whatsapp", label: "WhatsApp" },
] as const;

export function BookingsFilters({
  when,
  status,
  source,
  counts,
}: {
  when: string;
  status: string;
  source: string;
  counts: BookingCounts;
}) {
  const router = useRouter();

  function navigate(patch: Partial<{ when: string; status: string; source: string }>) {
    const next = { when, status, source, ...patch };
    const params = new URLSearchParams();
    if (next.when && next.when !== "today") params.set("when", next.when);
    if (next.status && next.status !== "all") params.set("status", next.status);
    if (next.source && next.source !== "all") params.set("source", next.source);
    const qs = params.toString();
    router.push(qs ? `/erp/bookings?${qs}` : "/erp/bookings");
  }

  const Group = ({
    label,
    activeKey,
    items,
    countsFor,
    onPick,
  }: {
    label: string;
    activeKey: string;
    items: readonly { k: string; label: string }[];
    countsFor: Record<string, number>;
    onPick: (k: string) => void;
  }) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-12 shrink-0 text-[0.65rem] font-semibold uppercase tracking-wider text-muted">{label}</span>
      {items.map((it) => {
        const active = activeKey === it.k;
        return (
          <button
            key={it.k}
            onClick={() => onPick(it.k)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
              active ? "border-gold bg-gold/15 text-gold" : "border-ink-line text-sand hover:border-gold/50"
            )}
          >
            {it.label}
            <span className={cn("text-xs", active ? "text-gold/70" : "text-muted")}>{countsFor[it.k] ?? 0}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="surface space-y-2.5 rounded-2xl p-4">
      <Group label="When" activeKey={when} items={WHEN} countsFor={counts.when} onPick={(k) => navigate({ when: k })} />
      <Group label="Status" activeKey={status} items={STATUS} countsFor={counts.status} onPick={(k) => navigate({ status: k })} />
      <Group label="Source" activeKey={source} items={SOURCE} countsFor={counts.source} onPick={(k) => navigate({ source: k })} />
    </div>
  );
}
