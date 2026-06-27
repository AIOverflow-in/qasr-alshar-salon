import Link from "next/link";
import { Scissors, Clock, Newspaper, Receipt } from "lucide-react";

export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/admin/services", label: "Services & Prices", icon: Scissors, desc: "Edit the service menu and pricing" },
  { href: "/admin/hours", label: "Hours, Capacity & Blocked Dates", icon: Clock, desc: "Opening hours and booking settings" },
  { href: "/erp/blog", label: "Blog", icon: Newspaper, desc: "AI articles + generate now" },
];

export default function ErpSettings() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-cream">Settings</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="surface surface-hover rounded-2xl p-5">
            <l.icon className="text-gold" size={22} />
            <div className="mt-3 font-display text-lg text-cream">{l.label}</div>
            <div className="text-sm text-muted">{l.desc}</div>
          </Link>
        ))}
      </div>
      <div className="surface rounded-2xl p-6 text-sm text-muted">
        <div className="flex items-center gap-2 text-cream"><Receipt size={18} className="text-gold" /> Tax &amp; policies (next slice)</div>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>VAT 5% + TRN on invoices/quotations · cancellation &amp; late-fee (AED 100 / 30 min) policy</li>
          <li>Service areas + minimum-order-value · user &amp; role management</li>
        </ul>
      </div>
    </div>
  );
}
