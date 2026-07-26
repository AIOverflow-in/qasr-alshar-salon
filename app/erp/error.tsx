"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/** ERP error boundary — turns a thrown server action / lapsed session into a recoverable screen
 *  instead of Next's bare crash page. Most common cause here is an expired session on a save. */
export default function ErpError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gold/15 text-gold">
          <AlertTriangle size={26} />
        </div>
        <h1 className="mt-5 font-display text-2xl text-cream">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted">
          This usually means your session expired or the connection dropped. Try again — if it keeps
          happening, sign in again.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button onClick={reset} className="rounded-full bg-gold-gradient px-5 py-2.5 text-sm font-semibold text-espresso">
            Try again
          </button>
          <Link href="/admin/login" className="rounded-full border border-ink-line px-5 py-2.5 text-sm text-sand hover:text-gold">
            Log in again
          </Link>
        </div>
      </div>
    </div>
  );
}
