"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Scissors,
  Clock,
  Newspaper,
  LogOut,
  Menu,
  X,
  ExternalLink,
} from "lucide-react";
import { Emblem } from "@/components/Logo";
import { logoutAction } from "@/lib/actions/admin";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/admin/services", label: "Services", icon: Scissors },
  { href: "/admin/hours", label: "Hours & Settings", icon: Clock },
  { href: "/admin/blog", label: "Blog", icon: Newspaper },
];

export function AdminShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link href="/admin" className="flex items-center gap-2 px-2 py-1">
        <Emblem className="h-9 w-9" />
        <span className="font-display text-lg text-gold-gradient">Qasr Admin</span>
      </Link>
      <nav className="mt-8 flex-1 space-y-1">
        {NAV.map((n) => {
          const active = n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active ? "bg-gold/15 text-gold" : "text-sand hover:bg-ink-card hover:text-cream"
              )}
            >
              <n.icon size={18} /> {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-1 border-t border-ink-line pt-3">
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sand hover:bg-ink-card hover:text-cream"
        >
          <ExternalLink size={18} /> View Site
        </Link>
        <form action={logoutAction}>
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sand hover:bg-ink-card hover:text-cream">
            <LogOut size={18} /> Logout
          </button>
        </form>
        <p className="truncate px-3 pt-2 text-xs text-muted">{email}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-svh bg-ink">
      {/* mobile topbar */}
      <div className="flex items-center justify-between border-b border-ink-line p-4 lg:hidden">
        <Link href="/admin" className="flex items-center gap-2">
          <Emblem className="h-8 w-8" />
          <span className="font-display text-gold-gradient">Qasr Admin</span>
        </Link>
        <button onClick={() => setOpen((v) => !v)} className="text-cream">
          {open ? <X /> : <Menu />}
        </button>
      </div>

      <div className="lg:flex">
        {/* desktop sidebar */}
        <aside className="sticky top-0 hidden h-svh w-64 shrink-0 border-r border-ink-line p-4 lg:block">
          {sidebar}
        </aside>

        {/* mobile drawer */}
        {open && (
          <aside className="fixed inset-0 z-50 bg-ink/98 p-4 lg:hidden">
            <div className="mb-4 flex justify-end">
              <button onClick={() => setOpen(false)} className="text-cream">
                <X />
              </button>
            </div>
            {sidebar}
          </aside>
        )}

        <main className="min-w-0 flex-1 p-5 md:p-8">{children}</main>
      </div>
    </div>
  );
}
