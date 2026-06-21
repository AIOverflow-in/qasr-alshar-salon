"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocale } from "@/lib/actions/locale";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export function LanguageToggle({
  locale,
  className,
}: {
  locale: Locale;
  className?: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function switchTo(next: Locale) {
    if (next === locale) return;
    start(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-ink-line text-xs",
        pending && "opacity-60",
        className
      )}
      aria-label="Language"
    >
      {(["en", "ar"] as const).map((l) => (
        <button
          key={l}
          onClick={() => switchTo(l)}
          className={cn(
            "rounded-full px-3 py-1.5 font-medium uppercase tracking-wider transition-colors",
            locale === l ? "bg-gold-gradient text-espresso" : "text-sand hover:text-gold"
          )}
        >
          {l === "en" ? "EN" : "ع"}
        </button>
      ))}
    </div>
  );
}
