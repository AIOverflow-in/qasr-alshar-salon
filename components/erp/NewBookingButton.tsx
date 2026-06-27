"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, X, Loader2, UserPlus, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type Service = { id: string; name: string; category: string; priceAED: number };
type Staff = { id: string; name: string };
type Client = { id: string; name: string; phone: string | null; email: string | null };

export function NewBookingButton({ services, staff, clients }: { services: Service[]; staff: Staff[]; clients: Client[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-gold-gradient px-4 py-2 text-sm font-semibold text-espresso">
        <CalendarPlus size={15} /> New booking
      </button>
      {open && <NewBookingModal services={services} staff={staff} clients={clients} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); router.refresh(); }} />}
    </>
  );
}

function NewBookingModal({ services, staff, clients, onClose, onSaved }: {
  services: Service[]; staff: Staff[]; clients: Client[]; onClose: () => void; onSaved: () => void;
}) {
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [when, setWhen] = useState("");
  const [mode, setMode] = useState<"SALON" | "HOME">("SALON");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [enforce, setEnforce] = useState(true);
  // client
  const [clientQuery, setClientQuery] = useState("");
  const [selClient, setSelClient] = useState<Client | null>(null);
  const [newClient, setNewClient] = useState(false);
  const [nc, setNc] = useState({ name: "", phone: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const matches = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return [];
    return clients.filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q)).slice(0, 6);
  }, [clients, clientQuery]);

  const input = "w-full rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-sm text-cream outline-none focus:border-gold/60";

  async function save() {
    setErr(null);
    if (!serviceId) return setErr("Pick a service.");
    if (!when) return setErr("Pick a date & time.");
    const name = newClient ? nc.name.trim() : selClient?.name;
    if (!name) return setErr("Choose an existing client or add a new one.");
    if (mode === "HOME" && address.trim().length < 4) return setErr("Add the home-service address.");

    const startISO = new Date(`${when}:00+04:00`).toISOString(); // entered time is Dubai (+04:00)
    setSaving(true);
    try {
      const res = await fetch("/api/erp/bookings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId, startISO, staffId: staffId || null,
          clientId: newClient ? null : selClient?.id ?? null,
          customerName: name,
          phone: newClient ? nc.phone : selClient?.phone ?? "",
          email: newClient ? nc.email : selClient?.email ?? "",
          serviceMode: mode, address: mode === "HOME" ? address : null,
          notes: notes || null, enforceAvailability: enforce,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "Could not create booking."); return; }
      onSaved();
    } catch { setErr("Network error."); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 py-10" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-ink-line bg-ink p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg text-cream">New booking</h3>
          <button onClick={onClose} className="text-muted hover:text-cream"><X size={18} /></button>
        </div>

        <div className="space-y-3">
          {/* client */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs text-muted">Client</span>
              <button onClick={() => { setNewClient((v) => !v); setSelClient(null); }} className="inline-flex items-center gap-1 text-xs text-gold hover:text-gold-deep">
                <UserPlus size={12} /> {newClient ? "Pick existing" : "New client"}
              </button>
            </div>
            {newClient ? (
              <div className="space-y-2">
                <input className={input} placeholder="Full name *" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <input className={input} placeholder="Phone" value={nc.phone} onChange={(e) => setNc({ ...nc, phone: e.target.value })} />
                  <input className={input} placeholder="Email" value={nc.email} onChange={(e) => setNc({ ...nc, email: e.target.value })} />
                </div>
              </div>
            ) : selClient ? (
              <div className="flex items-center justify-between rounded-lg border border-gold/30 bg-gold/5 px-3 py-2 text-sm">
                <span className="text-cream">{selClient.name} <span className="text-muted">{selClient.phone ?? ""}</span></span>
                <button onClick={() => setSelClient(null)} className="text-muted hover:text-cream"><X size={14} /></button>
              </div>
            ) : (
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input className={cn(input, "pl-9")} placeholder="Search name or phone…" value={clientQuery} onChange={(e) => setClientQuery(e.target.value)} />
                {matches.length > 0 && (
                  <div className="mt-1 rounded-lg border border-ink-line bg-ink-card divide-y divide-ink-line/60">
                    {matches.map((c) => (
                      <button key={c.id} onClick={() => { setSelClient(c); setClientQuery(""); }} className="flex w-full items-center justify-between px-3 py-2 text-start hover:bg-gold/5">
                        <span className="text-sm text-cream">{c.name}</span><span className="text-xs text-muted">{c.phone ?? ""}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* service + stylist */}
          <select className={input} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            <option value="">Select service *</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name} — AED {s.priceAED}</option>)}
          </select>
          <select className={input} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="">— Any Crown Artist —</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          {/* date-time */}
          <div>
            <label className="mb-1 block text-xs text-muted">Date &amp; time (Dubai)</label>
            <input type="datetime-local" className={input} value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>

          {/* mode */}
          <div className="grid grid-cols-2 gap-2">
            {(["SALON", "HOME"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={cn("rounded-lg border py-2 text-xs font-semibold", mode === m ? "border-gold bg-gold/15 text-gold" : "border-ink-line text-muted hover:border-gold/40")}>
                {m === "SALON" ? "At salon" : "Home service"}
              </button>
            ))}
          </div>
          {mode === "HOME" && <input className={input} placeholder="Home address" value={address} onChange={(e) => setAddress(e.target.value)} />}

          <input className={input} placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />

          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={!enforce} onChange={(e) => setEnforce(!e.target.checked)} className="h-4 w-4 accent-[#c8911f]" />
            Walk-in / phone — skip availability check
          </label>

          {err && <p className="text-sm text-red-400">{err}</p>}
          <button onClick={save} disabled={saving} className="w-full rounded-lg bg-gold-gradient py-2.5 text-sm font-semibold text-espresso disabled:opacity-50">
            {saving ? <span className="flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" /> Saving…</span> : "Create booking"}
          </button>
        </div>
      </div>
    </div>
  );
}
