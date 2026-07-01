"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Loader2, Plus, Search } from "lucide-react";
import { createService, updateService } from "@/lib/actions/admin";
import { cn } from "@/lib/utils";

type Service = { id: string; name: string; category: string; priceAED: number; durationMin: number; active: boolean };

const input = "rounded-lg border border-ink-line bg-ink-card px-2 py-1.5 text-cream outline-none focus:border-gold/60";

function Row({ s }: { s: Service }) {
  const [name, setName] = useState(s.name);
  const [category, setCategory] = useState(s.category);
  const [price, setPrice] = useState(s.priceAED);
  const [duration, setDuration] = useState(s.durationMin);
  const [active, setActive] = useState(s.active);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const dirty = name !== s.name || category !== s.category || price !== s.priceAED || duration !== s.durationMin || active !== s.active;

  function save() {
    setErr(null);
    start(async () => {
      try {
        await updateService(s.id, { name: name.trim(), category: category.trim(), priceAED: price, durationMin: duration, active });
        setSaved(true); setTimeout(() => setSaved(false), 1500);
      } catch { setErr("Could not save."); }
    });
  }

  return (
    <tr className={cn(pending && "opacity-60", !active && "opacity-60")}>
      <td className="p-2"><input value={name} onChange={(e) => setName(e.target.value)} className={cn(input, "w-44 text-sm")} /></td>
      <td className="p-2"><input value={category} onChange={(e) => setCategory(e.target.value)} list="svc-cats" className={cn(input, "w-40 text-sm")} /></td>
      <td className="p-2"><input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} className={cn(input, "w-24 text-right text-sm")} /></td>
      <td className="p-2"><input type="number" min={0} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={cn(input, "w-20 text-right text-sm")} title="Minutes" /></td>
      <td className="p-2">
        <button onClick={() => setActive((v) => !v)} className={cn("rounded-full border px-2.5 py-1 text-xs", active ? "border-green-500/40 text-green-400" : "border-muted/40 text-muted")}>
          {active ? "Active" : "Hidden"}
        </button>
      </td>
      <td className="p-2">
        <div className="flex items-center gap-2">
          <button onClick={save} disabled={!dirty || pending} className="flex items-center gap-1 rounded-lg bg-gold-gradient px-2.5 py-1.5 text-xs font-semibold text-espresso disabled:opacity-40">
            {pending ? <Loader2 size={12} className="animate-spin" /> : saved ? <Check size={12} /> : null}
            {saved ? "Saved" : "Save"}
          </button>
          {err && <span className="text-xs text-red-400">{err}</span>}
        </div>
      </td>
    </tr>
  );
}

export function ServicesManager({ services }: { services: Service[] }) {
  const [q, setQ] = useState("");
  const categories = useMemo(() => [...new Set(services.map((s) => s.category))].sort(), [services]);

  const [nName, setNName] = useState("");
  const [nCat, setNCat] = useState("");
  const [nPrice, setNPrice] = useState<number | "">("");
  const [nDur, setNDur] = useState<number | "">(60);
  const [adding, startAdd] = useTransition();
  const [addErr, setAddErr] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return query ? services.filter((s) => s.name.toLowerCase().includes(query) || s.category.toLowerCase().includes(query)) : services;
  }, [services, q]);

  function add() {
    setAddErr(null);
    if (!nName.trim() || !nCat.trim() || nPrice === "") { setAddErr("Name, category and price are required."); return; }
    startAdd(async () => {
      try {
        await createService({ name: nName.trim(), category: nCat.trim(), priceAED: Number(nPrice), durationMin: nDur === "" ? 60 : Number(nDur) });
        setNName(""); setNCat(""); setNPrice(""); setNDur(60);
      } catch { setAddErr("Could not add. That name may already exist."); }
    });
  }

  return (
    <div className="space-y-4">
      <datalist id="svc-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>

      {/* add new */}
      <div className="surface rounded-2xl p-4">
        <div className="mb-2 text-sm font-semibold text-cream">Add a service</div>
        <div className="flex flex-wrap items-end gap-2">
          <input value={nName} onChange={(e) => setNName(e.target.value)} placeholder="Service name" className={cn(input, "text-sm")} />
          <input value={nCat} onChange={(e) => setNCat(e.target.value)} placeholder="Category" list="svc-cats" className={cn(input, "text-sm")} />
          <div className="flex items-center gap-1"><span className="text-xs text-muted">AED</span><input type="number" min={0} value={nPrice} onChange={(e) => setNPrice(e.target.value === "" ? "" : Number(e.target.value))} placeholder="Price" className={cn(input, "w-24 text-right text-sm")} /></div>
          <div className="flex items-center gap-1"><input type="number" min={0} step={5} value={nDur} onChange={(e) => setNDur(e.target.value === "" ? "" : Number(e.target.value))} className={cn(input, "w-20 text-right text-sm")} /><span className="text-xs text-muted">min</span></div>
          <button onClick={add} disabled={adding} className="inline-flex items-center gap-1.5 rounded-lg bg-gold-gradient px-4 py-2 text-sm font-semibold text-espresso disabled:opacity-50">
            {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add
          </button>
          {addErr && <span className="text-xs text-red-400">{addErr}</span>}
        </div>
      </div>

      {/* search */}
      <div className="relative max-w-xs">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search services…" className="w-full rounded-full border border-ink-line bg-ink-card py-2 pl-9 pr-4 text-sm text-cream placeholder:text-muted outline-none focus:border-gold/60" />
      </div>

      {/* table */}
      <div className="surface overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-ink-line text-left text-muted">
            <tr>
              <th className="p-2 font-medium">Service</th>
              <th className="p-2 font-medium">Category</th>
              <th className="p-2 text-right font-medium">Price</th>
              <th className="p-2 text-right font-medium">Mins</th>
              <th className="p-2 font-medium">Status</th>
              <th className="p-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-line/60">
            {filtered.map((s) => <Row key={s.id} s={s} />)}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">{filtered.length} services · edits save per row. “Hidden” services stop appearing in booking & POS but keep their history.</p>
    </div>
  );
}
