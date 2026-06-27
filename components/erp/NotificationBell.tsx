"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, X, CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type Booking = { id: string; customerName: string; serviceName: string; startAt: string; createdAt: string; serviceMode: string; source: string };

const SEEN_KEY = "qa_notif_seen";
const POLL_MS = 25000;

function whenLabel(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
}

export function NotificationBell() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<Booking | null>(null);
  const [seen, setSeen] = useState<number>(() => {
    if (typeof window === "undefined") return Date.now();
    const v = window.localStorage.getItem(SEEN_KEY);
    return v ? Number(v) : Date.now();
  });
  const knownIds = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/erp/recent-bookings", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const list: Booking[] = data.bookings ?? [];
      setBookings(list);
      // Detect genuinely new bookings (not seen this session) for the toast + live refresh.
      const fresh = list.filter((b) => !knownIds.current.has(b.id));
      list.forEach((b) => knownIds.current.add(b.id));
      if (!firstLoad.current && fresh.length) {
        setToast(fresh[0]);
        setTimeout(() => setToast(null), 8000);
        router.refresh(); // live-update dashboard / bookings on screen
      }
      firstLoad.current = false;
    } catch { /* ignore */ }
  }, [router]);

  useEffect(() => {
    poll();
    const t = setInterval(poll, POLL_MS);
    const onVis = () => { if (document.visibilityState === "visible") poll(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [poll]);

  const unread = bookings.filter((b) => new Date(b.createdAt).getTime() > seen).length;

  function openPanel() {
    setOpen((v) => !v);
    if (!open) {
      const now = Date.now();
      setSeen(now);
      try { window.localStorage.setItem(SEEN_KEY, String(now)); } catch { /* ignore */ }
    }
  }

  return (
    <>
      <div className="fixed right-16 top-2.5 z-[60] lg:right-6 lg:top-4">
        <button onClick={openPanel} aria-label="Notifications" className="relative grid h-10 w-10 place-items-center rounded-full border border-ink-line bg-ink-card text-sand hover:border-gold/50 hover:text-gold">
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-espresso">{unread > 9 ? "9+" : unread}</span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-80 max-w-[85vw] overflow-hidden rounded-2xl border border-ink-line bg-ink shadow-2xl">
            <div className="flex items-center justify-between border-b border-ink-line px-4 py-3">
              <span className="font-display text-cream">Recent bookings</span>
              <button onClick={() => setOpen(false)} className="text-muted hover:text-cream"><X size={16} /></button>
            </div>
            <div className="max-h-[60vh] divide-y divide-ink-line/60 overflow-y-auto">
              {bookings.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">No bookings yet.</p>}
              {bookings.map((b) => (
                <a key={b.id} href="/erp/bookings" className="flex items-start gap-3 px-4 py-3 hover:bg-gold/5">
                  <CalendarCheck size={16} className="mt-0.5 shrink-0 text-gold" />
                  <div className="min-w-0">
                    <div className="truncate text-sm text-cream">{b.customerName} · {b.serviceName} {b.serviceMode === "HOME" && <span className="text-[0.65rem] text-gold">🏠</span>}</div>
                    <div className="text-xs text-muted">{whenLabel(b.startAt)}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed right-4 top-16 z-[70] w-72 max-w-[85vw] rounded-xl border border-gold/40 bg-ink p-4 shadow-2xl lg:top-20">
          <div className="flex items-start gap-2">
            <CalendarCheck size={18} className="mt-0.5 shrink-0 text-gold" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-cream">New booking 🎉</div>
              <div className="mt-0.5 truncate text-xs text-sand">{toast.customerName} · {toast.serviceName}</div>
              <div className="text-xs text-muted">{whenLabel(toast.startAt)}</div>
            </div>
            <button onClick={() => setToast(null)} className="ml-auto text-muted hover:text-cream"><X size={14} /></button>
          </div>
        </div>
      )}
    </>
  );
}
