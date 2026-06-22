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
    <span className={cn("inline-flex min-w-0 items-center gap-2.5", className)}>
      <Emblem className="h-10 w-auto shrink-0 sm:h-11" />
      {showText && (
        <span className="flex min-w-0 flex-col leading-none">
          <span className="truncate text-gold-gradient font-display text-lg font-semibold tracking-wide sm:text-xl">
            Qasr Alshar
          </span>
          <span className="hidden text-[0.6rem] uppercase tracking-[0.32em] text-muted sm:block">
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
