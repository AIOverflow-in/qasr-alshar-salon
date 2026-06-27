"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Search, X, Loader2, CheckCircle2 } from "lucide-react";
import { cn, aed } from "@/lib/utils";

type Service = { id: string; name: string; category: string; priceAED: number };

export function EditBookingServices({
  bookingId,
  services,
  initialServiceIds,
}: {
  bookingId: string;
  services: Service[];
  initialServiceIds: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>(initialServiceIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? services.filter((s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q))
      : services;
    return list.slice(0, 60);
  }, [services, query]);

  const total = useMemo(
    () => picked.reduce((sum, id) => sum + (services.find((s) => s.id === id)?.priceAED ?? 0), 0),
    [picked, services]
  );

  function toggle(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function openModal() {
    setPicked(initialServiceIds);
    setError(null);
    setQuery("");
    setOpen(true);
  }

  async function save() {
    if (picked.length === 0) { setError("Pick at least one service."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/erp/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceIds: picked }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Could not update."); return; }
      setOpen(false);
      router.refresh();
    } catch { setError("Network error — please try again."); }
    finally { setSaving(false); }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="inline-flex items-center gap-1 text-xs text-sand hover:text-gold"
        title="Add or remove services before the booking starts"
      >
        <Pencil size={12} /> Edit services
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => !saving && setOpen(false)}>
          <div
            className="surface flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-ink-line p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-xl text-cream">Edit services</h3>
              <button onClick={() => !saving && setOpen(false)} className="text-muted hover:text-cream"><X size={18} /></button>
            </div>

            <div className="relative mb-3">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search services…"
                className="w-full rounded-lg border border-ink-line bg-ink-card py-2 pl-9 pr-3 text-sm text-cream outline-none placeholder:text-muted focus:border-gold/60"
              />
            </div>

            <div className="min-h-0 flex-1 divide-y divide-ink-line/50 overflow-y-auto rounded-lg border border-ink-line/50">
              {filtered.map((s) => {
                const on = picked.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggle(s.id)}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-start hover:bg-gold/5"
                  >
                    <span className="flex items-center gap-2.5">
                      <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-md border", on ? "border-gold bg-gold-gradient text-espresso" : "border-ink-line text-transparent")}>
                        <CheckCircle2 size={12} />
                      </span>
                      <span>
                        <span className="block text-sm text-cream">{s.name}</span>
                        <span className="text-xs text-muted">{s.category}</span>
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-gold">{aed(s.priceAED)}</span>
                  </button>
                );
              })}
              {filtered.length === 0 && <div className="px-3 py-8 text-center text-sm text-muted">No services found</div>}
            </div>

            {error && <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-2.5 text-sm text-red-300">{error}</p>}

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-sm text-muted">
                {picked.length} selected · <span className="font-semibold text-gold">{aed(total)}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => !saving && setOpen(false)} className="rounded-lg border border-ink-line px-4 py-2 text-sm text-sand hover:text-cream">Cancel</button>
                <button
                  onClick={save}
                  disabled={saving || picked.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-gold-gradient px-4 py-2 text-sm font-semibold text-espresso disabled:opacity-50"
                >
                  {saving ? <><Loader2 className="animate-spin" size={15} /> Saving…</> : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
