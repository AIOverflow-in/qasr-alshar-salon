"use client";

import Image from "next/image";
import { useState, useEffect, useCallback, useMemo } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Reveal } from "@/components/Reveal";

type Photo = { src: string; label: string; category: string; description?: string };

const TABS = [
  { key: "all", label: "All" },
  { key: "hair", label: "Braiding & Hair" },
  { key: "nails", label: "Nails" },
  { key: "henna", label: "Henna" },
  { key: "salon", label: "Salon" },
];

const CTX: Record<string, string> = {
  hair: "Expert braiding & protective styling for Afro-textured hair at Qasr Alshar Salon, Dubai — near Union Metro, Deira.",
  nails: "Gel manicures, pedicures, nail art & extensions at Qasr Alshar Salon, Dubai — near Union Metro, Deira.",
  henna: "Natural bridal & traditional henna (mehndi) artistry by Qasr Alshar, Dubai — near Union Metro, Deira.",
  salon: "Inside Qasr Alshar — a premium multicultural beauty salon in Deira, Dubai, near Union Metro.",
};

/** SEO-rich caption woven from the photo's label + its category context. */
function describe(p: Photo): string {
  if (p.description) return p.description;
  return `${p.label} — ${CTX[p.category] ?? "Qasr Alshar Salon, Dubai."}`;
}

export function GalleryGrid({ photos }: { photos: Photo[] }) {
  const [active, setActive] = useState("all");
  const [open, setOpen] = useState<number | null>(null);

  // Remove exact-duplicate images (same src) while preserving order.
  const deduped = useMemo(() => {
    const seen = new Set<string>();
    return photos.filter((p) => (seen.has(p.src) ? false : (seen.add(p.src), true)));
  }, [photos]);

  const visible = useMemo(
    () => (active === "all" ? deduped : deduped.filter((p) => p.category === active)),
    [deduped, active]
  );

  const close = useCallback(() => setOpen(null), []);
  const next = useCallback(() => setOpen((i) => (i === null ? i : (i + 1) % visible.length)), [visible.length]);
  const prev = useCallback(() => setOpen((i) => (i === null ? i : (i - 1 + visible.length) % visible.length)), [visible.length]);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close, next, prev]);

  const current = open === null ? null : visible[open];

  return (
    <>
      {/* Filter tabs */}
      <div className="mb-10 flex flex-wrap justify-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setActive(t.key); setOpen(null); }}
            className={`rounded-full border px-5 py-2 text-sm font-medium transition-colors ${
              active === t.key
                ? "border-gold bg-gold text-espresso"
                : "border-ink-line text-sand hover:border-gold hover:text-gold"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((s, i) => (
          <Reveal
            key={s.src}
            delay={(i % 4) * 50}
            className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-ink-line"
          >
            <button
              type="button"
              onClick={() => setOpen(i)}
              className="absolute inset-0 h-full w-full cursor-zoom-in"
              aria-label={`View ${s.label} larger`}
            >
              <Image
                src={s.src}
                alt={describe(s)}
                fill
                sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 25vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <span className="absolute inset-0 flex items-end bg-gradient-to-t from-black/75 via-transparent to-transparent p-3 text-start opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <span className="font-display text-sm text-white drop-shadow">{s.label}</span>
              </span>
            </button>
          </Reveal>
        ))}
      </div>

      <p className="mt-6 text-center text-sm text-sand/60">
        {visible.length} photo{visible.length !== 1 ? "s" : ""}
        {active !== "all" && ` in ${TABS.find((t) => t.key === active)?.label}`}
      </p>

      {/* Lightbox */}
      {current && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={current.label}
          onClick={close}
        >
          <button onClick={close} aria-label="Close" className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full border border-white/20 text-white/80 hover:bg-white/10">
            <X size={22} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); prev(); }} aria-label="Previous" className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 text-white/80 hover:bg-white/10 sm:left-6">
            <ChevronLeft size={24} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); next(); }} aria-label="Next" className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 text-white/80 hover:bg-white/10 sm:right-6">
            <ChevronRight size={24} />
          </button>

          <figure className="flex max-h-[90vh] max-w-4xl flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="relative h-[68vh] w-[88vw] max-w-4xl overflow-hidden rounded-2xl">
              <Image src={current.src} alt={describe(current)} fill sizes="90vw" className="object-contain" priority />
            </div>
            <figcaption className="max-w-2xl text-center">
              <div className="font-display text-lg text-gold">{current.label}</div>
              <p className="mt-1 text-sm leading-relaxed text-sand/80">{describe(current)}</p>
            </figcaption>
          </figure>
        </div>
      )}
    </>
  );
}
