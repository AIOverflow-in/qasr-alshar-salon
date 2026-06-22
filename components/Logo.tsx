import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Qasr Alshar logo — the official crowned-"Q" emblem (real brand mark)
 * plus the salon wordmark.
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
      <Emblem className="h-11 w-auto shrink-0" />
      {showText && (
        <span className="flex flex-col leading-none">
          <span className="text-gold-gradient font-display text-xl font-semibold tracking-wide">
            Qasr Alshar
          </span>
          <span className="text-[0.6rem] uppercase tracking-[0.32em] text-muted">
            Beauty Salon · Dubai
          </span>
        </span>
      )}
    </span>
  );
}

export function Emblem({ className }: { className?: string }) {
  return (
    <Image
      src="/salon/logo-emblem.png"
      alt="Qasr Alshar emblem"
      width={654}
      height={629}
      priority
      className={cn("object-contain", className)}
    />
  );
}
