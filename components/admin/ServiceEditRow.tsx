"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { updateService } from "@/lib/actions/admin";
import { cn } from "@/lib/utils";

export function ServiceEditRow({
  id,
  name,
  priceAED,
  durationMin,
  active,
}: {
  id: string;
  name: string;
  priceAED: number;
  durationMin: number;
  active: boolean;
}) {
  const [price, setPrice] = useState(priceAED);
  const [duration, setDuration] = useState(durationMin);
  const [isActive, setIsActive] = useState(active);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const dirty =
    price !== priceAED || duration !== durationMin || isActive !== active;

  function save() {
    start(async () => {
      await updateService(id, { priceAED: price, durationMin: duration, active: isActive });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-3">
      <span className="min-w-40 flex-1 text-sand">{name}</span>

      <label className="flex items-center gap-1.5 text-xs text-muted">
        AED
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          className="w-20 rounded-lg border border-ink-line bg-ink-card px-2 py-1.5 text-cream outline-none focus:border-gold/60"
        />
      </label>

      <label className="flex items-center gap-1.5 text-xs text-muted">
        min
        <input
          type="number"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="w-20 rounded-lg border border-ink-line bg-ink-card px-2 py-1.5 text-cream outline-none focus:border-gold/60"
        />
      </label>

      <button
        onClick={() => setIsActive((v) => !v)}
        className={cn(
          "rounded-full border px-3 py-1.5 text-xs transition-colors",
          isActive ? "border-green-500/40 text-green-400" : "border-ink-line text-muted"
        )}
      >
        {isActive ? "Active" : "Hidden"}
      </button>

      <button
        onClick={save}
        disabled={!dirty || pending}
        className="flex items-center gap-1.5 rounded-lg bg-gold-gradient px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-40"
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
        {saved ? "Saved" : "Save"}
      </button>
    </div>
  );
}
