import { cn } from "@/lib/utils";
import { Reveal } from "../Reveal";

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "center" | "start";
  className?: string;
}) {
  return (
    <Reveal
      className={cn(
        "max-w-2xl",
        align === "center" ? "mx-auto text-center" : "text-start",
        className
      )}
    >
      {eyebrow && (
        <div
          className={cn(
            "mb-4 flex items-center gap-3 text-xs font-medium uppercase tracking-[0.3em] text-gold",
            align === "center" && "justify-center"
          )}
        >
          <span className="h-px w-8 bg-gold/60" />
          {eyebrow}
          <span className="h-px w-8 bg-gold/60" />
        </div>
      )}
      <h2 className="font-display text-4xl leading-tight text-cream md:text-5xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-base leading-relaxed text-sand/80 md:text-lg">
          {subtitle}
        </p>
      )}
    </Reveal>
  );
}
