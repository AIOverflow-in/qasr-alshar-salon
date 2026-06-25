"use client";

import Image from "next/image";
import { useState } from "react";
import { Reveal } from "@/components/Reveal";

type Photo = { src: string; label: string; category: string };

const TABS = [
  { key: "all", label: "All" },
  { key: "hair", label: "Braiding & Hair" },
  { key: "nails", label: "Nails" },
  { key: "henna", label: "Henna" },
  { key: "salon", label: "Salon" },
];

export function GalleryGrid({ photos }: { photos: Photo[] }) {
  const [active, setActive] = useState("all");
  const visible = active === "all" ? photos : photos.filter((p) => p.category === active);

  return (
    <>
      {/* Filter tabs */}
      <div className="mb-10 flex flex-wrap justify-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
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
            <Image
              src={s.src}
              alt={`${s.label} at Qasr Alshar Salon, Dubai`}
              fill
              sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-transparent to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <span className="font-display text-sm text-white drop-shadow">{s.label}</span>
            </div>
          </Reveal>
        ))}
      </div>

      <p className="mt-6 text-center text-sm text-sand/60">
        {visible.length} photo{visible.length !== 1 ? "s" : ""}
        {active !== "all" && ` in ${TABS.find((t) => t.key === active)?.label}`}
      </p>
    </>
  );
}
