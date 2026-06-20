"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { LanguageToggle } from "./LanguageToggle";
import { ButtonLink } from "./ui/Button";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

export function HeaderClient({
  locale,
  nav,
  bookLabel,
}: {
  locale: Locale;
  nav: Dictionary["nav"];
  bookLabel: string;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const links = [
    { href: "/services", label: nav.services },
    { href: "/henna", label: nav.henna },
    { href: "/packages", label: nav.packages },
    { href: "/gallery", label: nav.gallery },
    { href: "/blog", label: nav.blog },
    { href: "/about", label: nav.about },
    { href: "/contact", label: nav.contact },
  ];

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        scrolled
          ? "bg-ink/85 backdrop-blur-xl border-b border-ink-line"
          : "bg-gradient-to-b from-ink/80 to-transparent"
      )}
    >
      <div className="container-x flex h-18 items-center justify-between py-3">
        <Link href="/" aria-label="Qasr Alshar home" className="shrink-0">
          <Logo />
        </Link>

        {/* desktop nav */}
        <nav className="hidden items-center gap-7 lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "relative text-sm tracking-wide text-sand/90 transition-colors hover:text-gold",
                "after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-0 after:bg-gold after:transition-all hover:after:w-full",
                pathname.startsWith(l.href) && "text-gold after:w-full"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <LanguageToggle locale={locale} className="hidden sm:inline-flex" />
          <ButtonLink href="/book" size="sm" className="hidden sm:inline-flex">
            {bookLabel}
          </ButtonLink>
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-full border border-ink-line p-2 text-cream lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* mobile drawer */}
      <div
        className={cn(
          "fixed inset-0 top-[4.5rem] z-40 origin-top bg-ink/97 backdrop-blur-xl transition-all duration-300 lg:hidden",
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        )}
      >
        <nav className="container-x flex flex-col gap-1 py-8">
          {[{ href: "/", label: nav.home }, ...links].map((l, i) => (
            <Link
              key={l.href}
              href={l.href}
              className="border-b border-ink-line/60 py-4 font-display text-2xl text-cream transition-colors hover:text-gold"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {l.label}
            </Link>
          ))}
          <div className="mt-6 flex items-center justify-between">
            <LanguageToggle locale={locale} />
            <ButtonLink href="/book" size="md">
              {bookLabel}
            </ButtonLink>
          </div>
        </nav>
      </div>
    </header>
  );
}
