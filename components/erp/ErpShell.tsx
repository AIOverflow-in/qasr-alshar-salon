"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Package,
  Scissors,
  Wallet,
  ShoppingBag,
  Settings,
  LogOut,
  Menu,
  X,
  ExternalLink,
  ShoppingCart,
  Newspaper,
  Receipt,
  UserCog,
} from "lucide-react";
import { Emblem } from "@/components/Logo";
import { NotificationBell } from "@/components/erp/NotificationBell";
import { logoutAction } from "@/lib/actions/admin";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";

const NAV = [
  { href: "/erp", label: "Dashboard", icon: LayoutDashboard, roles: ["SUPER_ADMIN", "ADMIN", "RECEPTION", "STYLIST", "INVESTOR"] },
  { href: "/erp/pos", label: "POS Checkout", icon: ShoppingCart, roles: ["SUPER_ADMIN", "ADMIN", "RECEPTION"] },
  { href: "/erp/sales", label: "Sales", icon: Receipt, roles: ["SUPER_ADMIN", "ADMIN", "RECEPTION"] },
  { href: "/erp/bookings", label: "Bookings", icon: CalendarDays, roles: ["SUPER_ADMIN", "ADMIN", "RECEPTION", "STYLIST"] },
  { href: "/erp/clients", label: "Clients", icon: Users, roles: ["SUPER_ADMIN", "ADMIN", "RECEPTION"] },
  { href: "/erp/inventory", label: "Inventory", icon: Package, roles: ["SUPER_ADMIN", "ADMIN", "RECEPTION"] },
  { href: "/erp/staff", label: "Staff", icon: Scissors, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/erp/finance", label: "Finance", icon: Wallet, roles: ["SUPER_ADMIN", "ADMIN", "INVESTOR"] },
  { href: "/erp/blog", label: "Blog", icon: Newspaper, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/erp/products", label: "Storefront", icon: ShoppingBag, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/erp/users", label: "Users", icon: UserCog, roles: ["SUPER_ADMIN"] },
  { href: "/erp/settings", label: "Settings", icon: Settings, roles: ["SUPER_ADMIN", "ADMIN"] },
] as const;

const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Manager",
  RECEPTION: "Reception",
  STYLIST: "Crown Artist",
  INVESTOR: "Investor",
};

export function ErpShell({
  email,
  role,
  children,
}: {
  email: string;
  role: Role;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => (n.roles as readonly string[]).includes(role));

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link href="/erp" className="flex items-center gap-2 px-2 py-1">
        <Emblem className="h-9 w-auto" />
        <span className="font-display text-lg text-gold-gradient">Qasr ERP</span>
      </Link>
      <div className="mt-1 px-2 text-[0.65rem] uppercase tracking-widest text-muted">
        {ROLE_LABEL[role]}
      </div>
      <nav className="mt-6 flex-1 space-y-1">
        {items.map((n) => {
          const active = n.href === "/erp" ? pathname === "/erp" : pathname.startsWith(n.href);
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
        <Link href="/" target="_blank" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sand hover:bg-ink-card hover:text-cream">
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
      <NotificationBell />
      <div className="flex items-center justify-between border-b border-ink-line p-4 lg:hidden">
        <Link href="/erp" className="flex items-center gap-2">
          <Emblem className="h-8 w-auto" />
          <span className="font-display text-gold-gradient">Qasr ERP</span>
        </Link>
        <button onClick={() => setOpen((v) => !v)} className="text-cream">{open ? <X /> : <Menu />}</button>
      </div>
      <div className="lg:flex">
        <aside className="sticky top-0 hidden h-svh w-60 shrink-0 border-r border-ink-line p-4 lg:block">{sidebar}</aside>
        {open && (
          <aside className="fixed inset-0 z-50 bg-ink/98 p-4 lg:hidden">
            <div className="mb-4 flex justify-end"><button onClick={() => setOpen(false)} className="text-cream"><X /></button></div>
            {sidebar}
          </aside>
        )}
        <main className="min-w-0 flex-1 p-5 md:p-8 lg:pt-20">{children}</main>
      </div>
    </div>
  );
}
