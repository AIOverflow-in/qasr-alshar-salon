"use client";

import Image from "next/image";
import { useRef, useEffect, useState } from "react";
import { MapPin, Clock, ShieldCheck, Sparkles, Volume2, VolumeX } from "lucide-react";
import { ButtonLink } from "../ui/Button";
import { SITE } from "@/lib/site";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function Hero({ t }: { t: Dictionary }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [videoLoaded, setVideoLoaded] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onLoaded = () => setVideoLoaded(true);
    v.addEventListener("canplay", onLoaded);
    return () => v.removeEventListener("canplay", onLoaded);
  }, []);

  function toggleMute() {
    if (!videoRef.current) return;
    videoRef.current.muted = !muted;
    setMuted((m) => !m);
  }

  return (
    <section className="relative flex min-h-[100svh] items-center overflow-hidden">
      {/* fallback static image */}
      <Image
        src="/salon/salon-main.jpg"
        alt="Interior of Qasr Alshar Salon, Union Metro, Dubai"
        fill
        priority
        sizes="100vw"
        className={`object-cover transition-opacity duration-700 ${videoLoaded ? "opacity-0" : "opacity-100"}`}
      />
      {/* intro video */}
      <video
        ref={videoRef}
        src="/salon/intro.mp4"
        autoPlay
        muted
        loop
        playsInline
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${videoLoaded ? "opacity-100" : "opacity-0"}`}
      />

      {/* rich left scrim — keeps photo/video vivid, text readable */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-black/20" />
      {/* blend bottom into page */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ink" />

      {/* mute toggle */}
      <button
        onClick={toggleMute}
        aria-label={muted ? "Unmute video" : "Mute video"}
        className="absolute bottom-8 right-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white/80 backdrop-blur transition-colors hover:bg-black/60 sm:right-6"
      >
        {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
      </button>

      <div className="container-x relative z-10 pt-28 pb-24">
        <div className="max-w-2xl reveal">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-black/30 px-4 py-1.5 text-xs uppercase tracking-[0.28em] text-gold-bright backdrop-blur">
            <MapPin size={13} /> {t.hero.eyebrow}
          </div>

          <h1 className="font-display text-5xl leading-[1.05] sm:text-6xl md:text-7xl">
            <span className="text-gold-gradient">{t.hero.title}</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#efe7d6]">
            {t.hero.subtitle}
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <ButtonLink href="/book" size="lg">
              {t.hero.cta}
            </ButtonLink>
            <ButtonLink href="/services" size="lg" variant="outline">
              {t.hero.secondary}
            </ButtonLink>
          </div>

          <ul className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-[#efe7d6]/90">
            <li className="flex items-center gap-2">
              <Clock size={15} className="text-gold-bright" /> {t.common.openDaily}
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck size={15} className="text-gold-bright" /> Sterilised, single-use tools
            </li>
            <li className="flex items-center gap-2">
              <Sparkles size={15} className="text-gold-bright" /> Every hair type &amp; culture
            </li>
            <li>
              <a
                href={SITE.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold-bright transition-colors hover:text-white"
              >
                {SITE.social.instagramHandle}
              </a>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
