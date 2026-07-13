"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Measures ENGAGED time on each public page (time the tab is actually visible)
// and sends one beacon per page when the visitor leaves it — on client-side
// navigation, tab close, or backgrounding. Fire-and-forget via sendBeacon; it
// never blocks or affects the page. Mounted only on public pages (see layout).
const MIN_SEC = 2; // ignore sub-2s blips / accidental hits

export function PageTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const thisPath = pathname;
    let accumMs = 0;
    let segStart = performance.now();
    let counting = document.visibilityState === "visible";

    const pause = () => { if (counting) { accumMs += performance.now() - segStart; counting = false; } };
    const resume = () => { if (!counting) { segStart = performance.now(); counting = true; } };
    const onVisibility = () => (document.visibilityState === "hidden" ? pause() : resume());

    const send = () => {
      pause();
      const sec = Math.round(accumMs / 1000);
      accumMs = 0;
      if (sec >= MIN_SEC && navigator.sendBeacon) {
        navigator.sendBeacon("/api/track/pageview", JSON.stringify({ path: thisPath, sec }));
      }
      resume(); // page may be restored from bfcache — keep counting
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", send);

    // Cleanup fires on client-side navigation to a new path (or unmount): flush
    // this page's engaged time. After send() resets accumMs, any duplicate flush
    // is below MIN_SEC and sends nothing — so no double counting.
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", send);
      send();
    };
  }, [pathname]);

  return null;
}
