import Link from "next/link";
import { Emblem } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="grid min-h-svh place-items-center px-4 text-center">
      <div>
        <Emblem className="mx-auto h-16 w-16" />
        <h1 className="mt-6 font-display text-6xl text-gold-gradient">404</h1>
        <p className="mt-2 text-lg text-sand/80">This page has wandered off.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/" className="rounded-full bg-gold-gradient px-6 py-3 font-semibold text-ink">
            Go Home
          </Link>
          <Link href="/book" className="rounded-full border border-gold/40 px-6 py-3 text-cream hover:bg-gold/10">
            Book Now
          </Link>
        </div>
      </div>
    </div>
  );
}
