"use client";

import { useState } from "react";
import { PlusCircle, Pencil, X, Loader2, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";

const HAIR_TYPES = [
  "1A – Straight fine", "1B – Straight medium", "1C – Straight coarse",
  "2A – Wavy fine", "2B – Wavy medium", "2C – Wavy thick",
  "3A – Curly loose", "3B – Curly bouncy", "3C – Curly tight",
  "4A – Coily soft", "4B – Coily zigzag", "4C – Coily tight",
  "Low porosity", "High porosity", "Medium porosity",
  "Fine", "Medium", "Thick",
];

type ClientForm = {
  id?: string;
  name: string;
  phone: string;
  email: string;
  hairType: string;
  notes: string;
  consentMarketing: boolean;
};

const EMPTY: ClientForm = { name: "", phone: "", email: "", hairType: "", notes: "", consentMarketing: false };

export function ClientsManager({ editClient }: { editClient?: ClientForm } = {}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ClientForm>(editClient ?? EMPTY);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function field(k: keyof ClientForm) {
    return (v: string | boolean) => setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function save() {
    if (!form.name.trim()) { setError("Name is required."); return; }
    setError(null);
    setSaving(true);
    try {
      const method = form.id ? "PATCH" : "POST";
      const body = form.id ? form : { name: form.name, phone: form.phone || null, email: form.email || null, hairType: form.hairType || null, notes: form.notes || null, consentMarketing: form.consentMarketing };
      const res = await fetch("/api/erp/clients", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Save failed"); return; }
      setSaved(true);
      setTimeout(() => { setSaved(false); setOpen(false); setForm(editClient ?? EMPTY); router.refresh(); }, 1200);
    } catch { setError("Network error."); }
    finally { setSaving(false); }
  }

  const trigger = editClient ? (
    <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs text-muted hover:text-gold transition-colors">
      <Pencil size={12} /> Edit
    </button>
  ) : (
    <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full border border-gold/40 px-4 py-2 text-sm text-gold hover:bg-gold/10 transition-colors">
      <PlusCircle size={15} /> Add Client
    </button>
  );

  return (
    <>
      {trigger}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 pt-16 px-4 overflow-y-auto" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-ink-line bg-ink p-6 shadow-2xl space-y-4 my-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg text-cream">{editClient ? "Edit Client" : "New Client"}</h3>
              <button onClick={() => setOpen(false)} className="text-muted hover:text-cream"><X size={18} /></button>
            </div>

            <Field label="Full name *" value={form.name} onChange={field("name")} />
            <Field label="Phone" value={form.phone} onChange={field("phone")} type="tel" />
            <Field label="Email" value={form.email} onChange={field("email")} type="email" />

            <div>
              <label className="mb-1.5 block text-xs text-muted">Hair type / porosity</label>
              <select
                value={form.hairType}
                onChange={(e) => field("hairType")(e.target.value)}
                className="w-full rounded-xl border border-ink-line bg-ink-card px-3 py-2.5 text-sm text-cream outline-none focus:border-gold/60"
              >
                <option value="">— Select hair type —</option>
                {HAIR_TYPES.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-muted">Notes / preferences</label>
              <textarea
                value={form.notes}
                onChange={(e) => field("notes")(e.target.value)}
                rows={3}
                placeholder="Allergies, preferred products, style preferences…"
                className="w-full rounded-xl border border-ink-line bg-ink-card px-3 py-2.5 text-sm text-cream placeholder:text-muted outline-none focus:border-gold/60"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.consentMarketing}
                onChange={(e) => field("consentMarketing")(e.target.checked)}
                className="rounded border-ink-line accent-gold"
              />
              <span className="text-xs text-muted">Consents to marketing (WhatsApp / email)</span>
            </label>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button
              onClick={save}
              disabled={saving || saved}
              className="w-full rounded-xl bg-gold-gradient py-3 text-sm font-semibold text-espresso disabled:opacity-60"
            >
              {saved ? <span className="flex items-center justify-center gap-2"><CheckCircle2 size={15} /> Saved!</span>
                : saving ? <span className="flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" /> Saving…</span>
                : editClient ? "Save changes" : "Create client"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs text-muted">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-ink-line bg-ink-card px-3 py-2.5 text-sm text-cream outline-none focus:border-gold/60"
      />
    </div>
  );
}
