"use client";

import Link from "next/link";

/** Public-site error boundary — a calm, on-brand recovery screen instead of a raw crash. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-[70vh] place-items-center px-6">
      <div className="max-w-md text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Qasr Alshar</div>
        <h1 className="mt-3 font-display text-3xl text-cream">Something went wrong</h1>
        <p className="mt-3 text-sm text-muted">
          Sorry — that didn&apos;t load. Please try again, or reach us on WhatsApp and we&apos;ll help
          you book right away.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button onClick={reset} className="rounded-full bg-gold-gradient px-6 py-3 text-sm font-semibold text-espresso">
            Try again
          </button>
          <Link href="/" className="rounded-full border border-ink-line px-6 py-3 text-sm text-sand hover:text-gold">
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}
