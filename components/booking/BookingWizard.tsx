"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  Clock,
  ChevronRight,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  CalendarDays,
  CalendarClock,
  MessageCircle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { cn, aed, whatsappLink } from "@/lib/utils";
import { SITE } from "@/lib/site";

type Service = {
  id: string;
  name: string;
  priceAED: number;
  durationMin: number;
  category: string;
  categorySlug: string;
};
type Stylist = { id: string; name: string; role: string; offDay: string | null };
type Slot = { time: string; iso: string };
type Dict = Dictionary["booking"];

const DAYS = 30;

function addDaysISO(baseISO: string, n: number) {
  const [y, m, d] = baseISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}
function dayLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return {
    weekday: dt.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
    day: d,
    month: dt.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
  };
}
function timeLabel(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

export function BookingWizard({
  locale,
  dict,
  services,
  stylists,
  categoryOrder,
  initialServiceId,
  initialCategory,
}: {
  locale: Locale;
  dict: Dict;
  services: Service[];
  stylists: Stylist[];
  categoryOrder: string[];
  initialServiceId?: string;
  initialCategory?: string;
}) {
  const preselected = initialServiceId
    ? services.find((s) => s.id === initialServiceId) ?? null
    : null;
  const [step, setStep] = useState(preselected ? 2 : 1);
  const [query, setQuery] = useState(initialCategory ?? "");
  const [selected, setSelected] = useState<Service[]>(preselected ? [preselected] : []);
  const [stylist, setStylist] = useState<Stylist | null>(null);

  const totalDuration = selected.reduce((sum, s) => sum + s.durationMin, 0);
  const totalPrice = selected.reduce((sum, s) => sum + s.priceAED, 0);
  function toggleService(s: Service) {
    setSelected((prev) => (prev.some((x) => x.id === s.id) ? prev.filter((x) => x.id !== s.id) : [...prev, s]));
  }

  const todayISO = useMemo(
    () =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Dubai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    []
  );
  const dates = useMemo(
    () => Array.from({ length: DAYS }, (_, i) => addDaysISO(todayISO, i)),
    [todayISO]
  );

  const [date, setDate] = useState<string>(todayISO);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);

  const [form, setForm] = useState({
    name: "", email: "", phone: "", notes: "",
    serviceMode: "SALON" as "SALON" | "HOME",
    address: "", customRequest: "", agreed: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeBookingMsg, setActiveBookingMsg] = useState<string | null>(null);
  const [done, setDone] = useState<{ serviceName: string; whenLabel: string; priceAED: number; serviceMode: "SALON" | "HOME"; emailWarning?: string | null; ref?: string | null } | null>(null);

  // fetch availability whenever date / selection changes on step 3
  useEffect(() => {
    if (step !== 3 || selected.length === 0) return;
    let active = true;
    setLoadingSlots(true);
    setSlot(null);
    const params = new URLSearchParams({ date, duration: String(totalDuration) });
    if (stylist) params.set("staffId", stylist.id);
    fetch(`/api/availability?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (active) setSlots(d.slots ?? []);
      })
      .catch(() => active && setSlots([]))
      .finally(() => active && setLoadingSlots(false));
    return () => {
      active = false;
    };
  }, [step, date, totalDuration, selected.length, stylist]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? services.filter(
          (s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
        )
      : services;
    const map = new Map<string, Service[]>();
    for (const s of filtered) {
      if (!map.has(s.category)) map.set(s.category, []);
      map.get(s.category)!.push(s);
    }
    return [...map.entries()].sort(
      (a, b) => categoryOrder.indexOf(a[0]) - categoryOrder.indexOf(b[0])
    );
  }, [services, query, categoryOrder]);

  async function submit() {
    if (selected.length === 0 || !slot || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceIds: selected.map((s) => s.id),
          startISO: slot.iso,
          customerName: form.name,
          email: form.email,
          phone: form.phone,
          notes: form.notes || null,
          staffId: stylist?.id ?? null,
          locale,
          serviceMode: form.serviceMode,
          address: form.serviceMode === "HOME" ? form.address : null,
          customRequest: form.customRequest || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || "Something went wrong. Please try again.";
        // Already has an upcoming booking → friendly popup, stay on this step.
        if (data.code === "ACTIVE_BOOKING") { setActiveBookingMsg(msg); return; }
        // Slot/capacity conflict → show the reason here; they can go Back to re-pick a time.
        setError(msg);
        return;
      }
      setDone({
        serviceName: data.booking.serviceName,
        whenLabel: data.booking.whenLabel,
        priceAED: data.booking.priceAED,
        serviceMode: form.serviceMode,
        emailWarning: data.emailWarning ?? null,
        ref: data.booking.ref ?? null,
      });
      setStep(5);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const steps = [dict.step1, "Crown Artist", dict.step2, dict.step3];

  if (step === 5 && done) {
    return (
      <div className="mx-auto mt-12 max-w-lg text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gold/15 text-gold">
          <CheckCircle2 size={44} />
        </div>
        <h2 className="mt-6 font-display text-3xl text-cream">{dict.successTitle}</h2>
        <p className="mt-3 text-sand/80">{dict.successBody}</p>
        <div className="surface mt-8 rounded-2xl p-6 text-start">
          {done.ref && <Row k="Booking Ref" v={done.ref} />}
          <Row k={dict.step1} v={done.serviceName} />
          {stylist && <Row k="Crown Artist" v={stylist.name} />}
          <Row k={dict.date} v={done.whenLabel} />
          <Row k="Price" v={aed(done.priceAED)} />
          <Row k="Location" v={done.serviceMode === "HOME" ? "Home service (we come to you)" : `${SITE.address.line1}, ${SITE.address.city}`} />
        </div>
        <p className="mt-4 text-sm text-muted">
          {done.serviceMode === "HOME"
            ? "No payment now. Your home visit is pending — our team will confirm the time and any minimum order on WhatsApp."
            : "No payment now — pay at the salon. We'll message you on WhatsApp to confirm."}
        </p>
        {done.emailWarning && (
          <p className="mx-auto mt-3 max-w-md rounded-lg border border-gold/30 bg-gold/5 px-4 py-2.5 text-xs text-gold">
            {done.emailWarning}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a
            href={whatsappLink(
              SITE.whatsapp,
              `Hi Qasr Alshar! I just booked ${done.serviceName} for ${done.whenLabel}.`
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-gold-gradient px-6 py-3 font-semibold text-espresso"
          >
            Confirm on WhatsApp
          </a>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${SITE.address.mapsQuery}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-gold/40 px-6 py-3 text-cream hover:bg-gold/10"
          >
            Get Directions
          </a>
          <Link href="/" className="rounded-full border border-ink-line px-6 py-3 text-sand hover:text-gold">
            Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-10 max-w-3xl">
      {/* stepper */}
      <ol className="mb-8 flex items-center justify-center gap-2 text-xs">
        {steps.map((label, i) => {
          const n = i + 1;
          const active = step === n;
          const complete = step > n;
          return (
            <li key={label} className="flex items-center gap-2">
              <span
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-full border text-xs font-semibold transition-colors",
                  active && "border-gold bg-gold-gradient text-espresso",
                  complete && "border-gold/60 bg-gold/15 text-gold",
                  !active && !complete && "border-ink-line text-muted"
                )}
              >
                {complete ? "✓" : n}
              </span>
              <span className={cn("hidden sm:inline", active ? "text-cream" : "text-muted")}>
                {label}
              </span>
              {n < steps.length && <ChevronRight size={14} className="text-ink-line" />}
            </li>
          );
        })}
      </ol>

      {/* STEP 1 — service */}
      {step === 1 && (
        <div>
          <div className="relative mb-5">
            <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search services…"
              className="w-full rounded-full border border-ink-line bg-ink-card py-3 pl-11 pr-4 text-cream outline-none placeholder:text-muted focus:border-gold/60"
            />
          </div>
          <p className="mb-4 text-sm text-muted">Pick one or more services — book them together in a single visit.</p>
          <div className="max-h-[55svh] space-y-6 overflow-y-auto pr-1">
            {grouped.map(([cat, items]) => (
              <div key={cat}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gold">
                  {cat}
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {items.map((s) => {
                    const isOn = selected.some((x) => x.id === s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => toggleService(s)}
                        aria-pressed={isOn}
                        className={cn(
                          "surface surface-hover flex items-center justify-between rounded-xl p-3.5 text-start transition-colors",
                          isOn && "border-gold bg-gold/10"
                        )}
                      >
                        <span className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              "grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors",
                              isOn ? "border-gold bg-gold-gradient text-espresso" : "border-ink-line text-transparent"
                            )}
                          >
                            <CheckCircle2 size={12} />
                          </span>
                          <span>
                            <span className="block text-cream">{s.name}</span>
                            <span className="flex items-center gap-1 text-xs text-muted">
                              <Clock size={12} /> {s.durationMin} min
                            </span>
                          </span>
                        </span>
                        <span className="font-semibold text-gold">{aed(s.priceAED)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {grouped.length === 0 && (
              <p className="text-center text-muted">No services match “{query}”.</p>
            )}
          </div>

          {selected.length > 0 && (
            <div className="sticky bottom-0 mt-4 flex items-center justify-between gap-3 rounded-2xl border border-gold/30 bg-ink-card/95 p-3.5 backdrop-blur">
              <div className="min-w-0 text-sm">
                <div className="text-cream">
                  {selected.length} service{selected.length > 1 ? "s" : ""} · {totalDuration} min
                </div>
                <div className="text-xs text-muted">Total {aed(totalPrice)} · incl. VAT</div>
              </div>
              <Button onClick={() => setStep(2)}>
                {dict.next} <ChevronRight size={16} />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* STEP 2 — stylist selection */}
      {step === 2 && selected.length > 0 && (
        <div>
          <SelectionSummary services={selected} />
          <div className="mt-6">
            <h3 className="mb-1 font-display text-xl text-cream">Choose your Crown Artist</h3>
            <p className="mb-4 text-sm text-muted">All our artists are fully trained. If you have no preference, choose &ldquo;Any Available&rdquo; for the first open slot.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => { setStylist(null); setStep(3); }}
                className={cn(
                  "rounded-xl border p-4 text-start transition-colors",
                  stylist === null ? "border-gold bg-gold/10 text-cream" : "border-ink-line text-sand hover:border-gold/50"
                )}
              >
                <div className="font-semibold text-cream">Any Available</div>
                <div className="text-xs text-muted mt-0.5">First open slot, any artist</div>
              </button>
              {stylists.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setStylist(s); setStep(3); }}
                  className={cn(
                    "rounded-xl border p-4 text-start transition-colors",
                    stylist?.id === s.id ? "border-gold bg-gold/10" : "border-ink-line hover:border-gold/50"
                  )}
                >
                  <div className="font-semibold text-cream">{s.name}</div>
                  <div className="text-xs text-muted mt-0.5">{s.role}{s.offDay ? ` · Off: ${s.offDay}` : ""}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-8">
            <button onClick={() => setStep(1)} className="inline-flex items-center gap-1 text-sm text-muted hover:text-gold">
              <ChevronLeft size={14} /> Back
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 — date & time */}
      {step === 3 && selected.length > 0 && (
        <div>
          <SelectionSummary services={selected} stylistName={stylist?.name ?? "Any Available"} />
          <h3 className="mb-3 mt-6 flex items-center gap-2 font-display text-lg text-cream">
            <CalendarDays size={18} className="text-gold" /> {dict.date}
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {dates.map((iso) => {
              const l = dayLabel(iso);
              const active = iso === date;
              return (
                <button
                  key={iso}
                  onClick={() => setDate(iso)}
                  className={cn(
                    "flex min-w-16 shrink-0 flex-col items-center rounded-xl border px-3 py-2.5 transition-colors",
                    active ? "border-gold bg-gold-gradient text-espresso" : "border-ink-line text-sand hover:border-gold/50"
                  )}
                >
                  <span className="text-[0.65rem] uppercase">{l.weekday}</span>
                  <span className="text-lg font-semibold leading-none">{l.day}</span>
                  <span className="text-[0.6rem]">{l.month}</span>
                </button>
              );
            })}
          </div>

          <h3 className="mb-3 mt-6 font-display text-lg text-cream">{dict.availableTimes}</h3>
          {loadingSlots ? (
            <div className="flex items-center gap-2 py-8 text-muted">
              <Loader2 className="animate-spin" size={18} /> Loading…
            </div>
          ) : slots.length === 0 ? (
            <p className="py-8 text-muted">{dict.noSlots}</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((s) => (
                <button
                  key={s.iso}
                  onClick={() => setSlot(s)}
                  className={cn(
                    "rounded-lg border py-2.5 text-sm transition-colors",
                    slot?.iso === s.iso
                      ? "border-gold bg-gold-gradient text-espresso"
                      : "border-ink-line text-sand hover:border-gold/50"
                  )}
                >
                  {timeLabel(s.time)}
                </button>
              ))}
            </div>
          )}

          <div className="mt-8 flex justify-between">
            <Button variant="ghost" onClick={() => setStep(2)}>
              <ChevronLeft size={16} /> {dict.back}
            </Button>
            <Button disabled={!slot} onClick={() => setStep(4)}>
              {dict.next} <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4 — details */}
      {step === 4 && selected.length > 0 && slot && (
        <div>
          <SelectionSummary services={selected} stylistName={stylist?.name ?? "Any Available"} when={`${dayLabel(date).weekday} ${dayLabel(date).day} ${dayLabel(date).month} · ${timeLabel(slot.time)}`} />
          <div className="mt-6 space-y-4">
            <Field label={dict.name} value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label={dict.email} type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            <Field label={dict.phone} type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            {/* where: salon vs home */}
            <div>
              <label className="mb-1.5 block text-sm text-sand">Where would you like the service?</label>
              <div className="grid grid-cols-2 gap-2">
                {(["SALON", "HOME"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setForm({ ...form, serviceMode: m })}
                    className={cn(
                      "rounded-xl border p-3 text-start transition-colors",
                      form.serviceMode === m ? "border-gold bg-gold/10 text-cream" : "border-ink-line text-sand hover:border-gold/50"
                    )}
                  >
                    <div className="font-semibold text-cream">{m === "SALON" ? "At the salon" : "Home service"}</div>
                    <div className="mt-0.5 text-xs text-muted">{m === "SALON" ? "Union Metro, Deira" : "We come to you — confirmed first"}</div>
                  </button>
                ))}
              </div>
            </div>

            {form.serviceMode === "HOME" && (
              <div>
                <label className="mb-1.5 block text-sm text-sand">Your address (area, building, contact)</label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  rows={2}
                  placeholder="e.g. Marina, Tower X, Apt 000 — gate code…"
                  className="w-full rounded-xl border border-ink-line bg-ink-card p-3 text-cream outline-none focus:border-gold/60"
                />
                <p className="mt-1 text-xs text-muted">Home &amp; clinic visits are confirmed by our team on WhatsApp before they&apos;re final. A minimum order may apply by area.</p>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm text-sand">Can&apos;t find a service, or want something specific?</label>
              <textarea
                value={form.customRequest}
                onChange={(e) => setForm({ ...form, customRequest: e.target.value })}
                rows={2}
                placeholder="Describe the look or service you'd like and we'll arrange it."
                className="w-full rounded-xl border border-ink-line bg-ink-card p-3 text-cream outline-none focus:border-gold/60"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-sand">{dict.notes}</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full rounded-xl border border-ink-line bg-ink-card p-3 text-cream outline-none focus:border-gold/60"
              />
            </div>

            {/* terms */}
            <label className="flex items-start gap-3 rounded-xl border border-ink-line bg-ink-card/50 p-3.5">
              <input
                type="checkbox"
                checked={form.agreed}
                onChange={(e) => setForm({ ...form, agreed: e.target.checked })}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#c8911f]"
              />
              <span className="text-xs leading-relaxed text-muted">
                I agree to Qasr Alshar&apos;s booking terms: a 15-minute grace period applies, after which lateness may incur AED 100 per 30 minutes. Cancellations within 24 hours and no-shows may be charged. Prices include 5% VAT. Home/clinic visits are confirmed by the salon before they are final.
              </span>
            </label>
          </div>

          {error && (
            <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </p>
          )}

          <div className="mt-8 flex justify-between">
            <Button variant="ghost" onClick={() => setStep(3)}>
              <ChevronLeft size={16} /> {dict.back}
            </Button>
            <Button
              onClick={submit}
              disabled={
                submitting ||
                form.name.length < 2 ||
                !form.email.includes("@") ||
                form.phone.length < 6 ||
                !form.agreed ||
                (form.serviceMode === "HOME" && form.address.trim().length < 6)
              }
            >
              {submitting ? <Loader2 className="animate-spin" size={16} /> : null}
              {dict.confirm}
            </Button>
          </div>
        </div>
      )}

      {/* Already-has-a-booking popup */}
      {activeBookingMsg && (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setActiveBookingMsg(null)}
        >
          <div
            className="surface relative w-full max-w-sm rounded-2xl border border-gold/30 p-7 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveBookingMsg(null)}
              aria-label="Close"
              className="absolute right-3 top-3 text-muted hover:text-cream"
            >
              <X size={18} />
            </button>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gold/15 text-gold">
              <CalendarClock size={30} />
            </div>
            <h3 className="mt-5 font-display text-2xl text-cream">You already have a booking</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-sand/80">{activeBookingMsg}</p>
            <div className="mt-6 flex flex-col gap-2.5">
              <a
                href={whatsappLink(SITE.whatsapp, "Hi Qasr Alshar! I'd like to adjust or cancel my upcoming booking.")}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gold-gradient px-5 py-3 text-sm font-semibold text-espresso"
              >
                <MessageCircle size={16} /> Message us on WhatsApp
              </a>
              <button
                onClick={() => setActiveBookingMsg(null)}
                className="rounded-full border border-ink-line px-5 py-3 text-sm text-sand hover:text-gold"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-ink-line/50 py-2 last:border-0">
      <span className="text-muted">{k}</span>
      <span className="font-medium text-cream">{v}</span>
    </div>
  );
}

function SelectionSummary({ services, stylistName, when }: { services: Service[]; stylistName?: string; when?: string }) {
  const totalDuration = services.reduce((sum, s) => sum + s.durationMin, 0);
  const totalPrice = services.reduce((sum, s) => sum + s.priceAED, 0);
  return (
    <div className="surface rounded-xl p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-cream">
            {services.length === 1 ? services[0].name : `${services.length} services`}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
            <span className="flex items-center gap-1"><Clock size={12} /> {totalDuration} min</span>
            {stylistName && <span>· {stylistName}</span>}
            {when && <span>· {when}</span>}
          </div>
        </div>
        <span className="whitespace-nowrap font-semibold text-gold">{aed(totalPrice)}</span>
      </div>
      {services.length > 1 && (
        <ul className="mt-2 space-y-0.5 border-t border-ink-line/50 pt-2 text-xs">
          {services.map((s) => (
            <li key={s.id} className="flex justify-between gap-2 text-sand">
              <span>{s.name}</span>
              <span className="text-muted">{aed(s.priceAED)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm text-sand">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-ink-line bg-ink-card p-3 text-cream outline-none focus:border-gold/60"
      />
    </div>
  );
}
