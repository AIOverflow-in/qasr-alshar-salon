import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { aed } from "@/lib/utils";

/**
 * "Last month isn't closed yet" — surfaced only while looking at the current month, because that is
 * exactly when an unfinished previous month is invisible and easy to forget. Without this the only
 * way to notice is to change the month dropdown and go looking.
 */
export function PreviousMonthAlert({
  month,
  monthLabel,
  dueCount,
  outstandingAED,
}: {
  month: string;
  monthLabel: string;
  dueCount: number;
  outstandingAED: number;
}) {
  return (
    <Link
      href={`/erp/staff?month=${month}`}
      className="group flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-gold/40 bg-gold/5 px-5 py-4 transition-colors hover:border-gold/70 hover:bg-gold/10"
    >
      <AlertTriangle size={18} className="shrink-0 text-gold" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-cream">{monthLabel} isn&apos;t closed yet</div>
        <div className="text-xs text-muted">
          {dueCount} {dueCount === 1 ? "artist is" : "artists are"} still unpaid — {aed(outstandingAED)} outstanding.
        </div>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-gold">
        Close {monthLabel}
        <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
