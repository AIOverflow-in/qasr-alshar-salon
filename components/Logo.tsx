import { cn } from "@/lib/utils";

/**
 * Qasr Alshar wordmark — a gold crowned "Q" emblem with the salon name.
 * Vector, so it stays crisp at every size.
 */
export function Logo({
  className,
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <Emblem className="h-10 w-10 shrink-0" />
      {showText && (
        <span className="flex flex-col leading-none">
          <span className="text-gold-gradient font-display text-xl font-semibold tracking-wide">
            Qasr Alshar
          </span>
          <span className="text-[0.6rem] uppercase tracking-[0.32em] text-sand/70">
            Beauty Salon · Dubai
          </span>
        </span>
      )}
    </span>
  );
}

export function Emblem({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="Qasr Alshar emblem"
    >
      <defs>
        <linearGradient id="qa-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9a7a2e" />
          <stop offset="45%" stopColor="#e7c878" />
          <stop offset="60%" stopColor="#f3e2b0" />
          <stop offset="100%" stopColor="#9a7a2e" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="31" fill="#0b0a08" stroke="url(#qa-gold)" strokeWidth="1.5" />
      {/* crown */}
      <path
        d="M22 22 L26 16 L32 21 L38 16 L42 22 L40 25 L24 25 Z"
        fill="url(#qa-gold)"
      />
      <circle cx="26" cy="15" r="1.6" fill="url(#qa-gold)" />
      <circle cx="32" cy="20" r="1.6" fill="url(#qa-gold)" />
      <circle cx="38" cy="15" r="1.6" fill="url(#qa-gold)" />
      {/* Q letter */}
      <circle
        cx="32"
        cy="38"
        r="11"
        fill="none"
        stroke="url(#qa-gold)"
        strokeWidth="2.5"
      />
      <path
        d="M36 42 L43 49"
        stroke="url(#qa-gold)"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
