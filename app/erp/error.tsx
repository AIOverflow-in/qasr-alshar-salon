"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

/** ERP error boundary — keeps transient service failures recoverable. */
export default function ErpError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("ERP page error", error);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gold/15 text-gold">
          <AlertTriangle size={26} />
        </div>
        <h1 className="mt-5 font-display text-2xl text-cream">We couldn’t load this ERP page</h1>
        <p className="mt-2 text-sm text-muted">
          The ERP could not reach one of its services. Try again in a moment. If the problem continues,
          contact support; signing in again will not fix a service outage.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button onClick={unstable_retry} className="rounded-full bg-gold-gradient px-5 py-2.5 text-sm font-semibold text-espresso">
            Try again
          </button>
          <Link href="/admin/login" className="rounded-full border border-ink-line px-5 py-2.5 text-sm text-sand hover:text-gold">
            Go to login
          </Link>
        </div>
      </div>
    </div>
  );
}
