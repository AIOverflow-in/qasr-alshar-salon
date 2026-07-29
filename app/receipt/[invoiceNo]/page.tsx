import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TAX } from "@/lib/tax";
import { SITE } from "@/lib/site";
import { buildReceipt } from "@/lib/receipt-core";
import { AutoPrint } from "./AutoPrint";

export const dynamic = "force-dynamic";

// Roles that ring up sales and therefore print receipts.
const POS_ROLES = ["SUPER_ADMIN", "ADMIN", "RECEPTION"];

const money = (n: number) => `AED ${n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* Premium thermal receipt. To use a 58mm printer instead of 80mm, change --w (and the @page size). */
const CSS = `
  .rcpt { --w: 80mm; width: var(--w); margin: 0 auto; padding: 5mm 4mm 6mm; box-sizing: border-box;
    color:#111; background:#fff; font-family: var(--font-jost), ui-sans-serif, system-ui, sans-serif;
    font-size: 11px; line-height: 1.5; -webkit-font-smoothing: antialiased; }
  .rcpt .serif { font-family: var(--font-playfair), Georgia, serif; }
  .rcpt .c { text-align:center; }
  .rcpt .crest { width: 19mm; height:auto; margin: 0 auto 3mm; display:block; }
  .rcpt .brand { font-size: 19px; font-weight:600; letter-spacing:.18em; text-transform:uppercase; }
  .rcpt .tagline { font-style:italic; font-size:10.5px; color:#555; margin-top:1px; }
  .rcpt .contact { font-size:9px; color:#555; margin-top:3px; letter-spacing:.02em; }
  .rcpt .title { font-size:12px; font-weight:600; letter-spacing:.34em; text-transform:uppercase; margin:2px 0 8px; }
  .rcpt .ornament { text-align:center; letter-spacing:.5em; color:#999; font-size:9px; margin:5px 0; }
  .rcpt .rule { border-top:1px solid #111; margin:7px 0; }
  .rcpt .rule.thin { border-top:1px dashed #bbb; }
  .rcpt .small { font-size:9px; }
  .rcpt .muted { color:#666; }
  .rcpt .kv { display:flex; justify-content:space-between; gap:10px; font-size:10px; }
  .rcpt .kv .k { color:#666; text-transform:uppercase; letter-spacing:.08em; font-size:8.5px; }
  .rcpt .item { margin:5px 0; }
  .rcpt .item .name { font-weight:600; }
  .rcpt .item .line { display:flex; justify-content:space-between; gap:10px; color:#333; }
  .rcpt .item .line .amt { white-space:nowrap; }
  .rcpt .totrow { display:flex; justify-content:space-between; gap:10px; font-size:10px; color:#444; margin:1px 0; }
  .rcpt .total { display:flex; justify-content:space-between; align-items:baseline; gap:10px;
    font-size:16px; font-weight:700; margin:6px 0 2px; padding-top:5px; border-top:2px solid #111; }
  .rcpt .qr { width: 21mm; height:auto; margin: 4mm auto 2mm; display:block; }
  .rcpt .thanks { font-size:14px; margin:8px 0 5px; }
  .rcpt .legal { font-size:8px; color:#666; letter-spacing:.02em; }
  @media print {
    @page { size: 80mm auto; margin: 0; }
    html, body { background:#fff !important; }
    .no-print { display:none !important; }
  }
`;

export default async function ReceiptPage({ params }: { params: Promise<{ invoiceNo: string }> }) {
  const { invoiceNo } = await params;
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (!POS_ROLES.includes(session.role)) redirect("/erp");

  const order = await prisma.salesOrder.findUnique({
    where: { invoiceNo },
    include: {
      lines: true,
      client: { select: { name: true } },
      booking: { select: { customerName: true } },
    },
  });
  if (!order) notFound();

  // Resolve each line's artist id(s) to names.
  const ids = new Set<string>();
  for (const l of order.lines) { (l.staffIds ?? []).forEach((i) => ids.add(i)); if (l.staffId) ids.add(l.staffId); }
  const staff = ids.size ? await prisma.staff.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true } }) : [];
  const nameOf = new Map(staff.map((s) => [s.id, s.name]));
  const lines = order.lines.map((l) => {
    const sids = l.staffIds && l.staffIds.length ? l.staffIds : l.staffId ? [l.staffId] : [];
    return { description: l.description, qty: l.qty, unitAED: l.unitAED, lineAED: l.lineAED, staffNames: sids.map((i) => nameOf.get(i)).filter((n): n is string => !!n) };
  });

  const r = buildReceipt(
    {
      invoiceNo: order.invoiceNo, createdAt: order.createdAt, paymentMethod: order.paymentMethod,
      splitPayment: order.splitPayment, cashAED: order.cashAED ?? undefined, cardAED: order.cardAED ?? undefined, transferAED: order.transferAED ?? undefined,
      subtotalAED: order.subtotalAED, vatAED: order.vatAED, vatPct: order.vatPct, totalAED: order.totalAED,
      lines, clientName: order.client?.name ?? order.booking?.customerName ?? null,
    },
    TAX.vatRegistered,
  );
  const title = TAX.vatRegistered ? "Tax Invoice" : "Receipt";

  return (
    <>
      <style>{CSS}</style>
      <AutoPrint />
      <div className="rcpt">
        <div className="c">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="crest" src="/brand/crest.png" alt="" />
          <div className="brand serif">Qasr Alshar</div>
          <div className="tagline serif">Dubai&apos;s Crown of Beauty</div>
          <div className="contact">{SITE.address.line1}, {SITE.address.city}</div>
          <div className="contact">{SITE.phones[0].label}</div>
        </div>

        <div className="ornament">— ◆ —</div>
        <div className="c title serif">{title}</div>

        <div className="kv"><span className="k">Receipt No</span><span>{r.invoiceNo}</span></div>
        <div className="kv"><span className="k">Date</span><span>{r.dateLabel}</span></div>
        <div className="kv"><span className="k">Customer</span><span>{r.clientName}</span></div>

        <div className="rule thin" />
        {r.items.map((it, i) => (
          <div key={i} className="item">
            <div className="name">{it.name}</div>
            {it.by && <div className="small muted">by {it.by}</div>}
            <div className="line"><span>{it.qty} × {money(it.unitAED)}</span><span className="amt">{money(it.lineAED)}</span></div>
          </div>
        ))}

        <div className="rule thin" />
        {r.showVat && (
          <>
            <div className="totrow"><span>Subtotal (excl. VAT)</span><span>{money(r.subtotalAED)}</span></div>
            <div className="totrow"><span>VAT {r.vatPct}%</span><span>{money(r.vatAED)}</span></div>
          </>
        )}
        <div className="total serif"><span>Total</span><span>{money(r.totalAED)}</span></div>
        {r.showVat && <div className="totrow" style={{ justifyContent: "flex-end" }}><span className="small muted">Includes {r.vatPct}% VAT</span></div>}
        <div className="totrow"><span>Paid by</span><span>{r.paymentLabel}</span></div>

        <div className="rule" />
        <div className="c">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="qr" src="/brand/review-qr.png" alt="" />
          <div className="small">Enjoyed your visit?</div>
          <div className="small" style={{ fontWeight: 600 }}>Scan to review us on Google</div>
        </div>

        <div className="rule thin" />
        <div className="c thanks serif">Thank you 👑</div>
        <div className="c legal">{SITE.legal.name}</div>
        {TAX.vatRegistered && <div className="c legal">VAT TRN {TAX.vatTRN}</div>}
        <div className="c small muted" style={{ marginTop: "3px" }}>{SITE.social.instagramHandle} · {SITE.url.replace(/^https?:\/\//, "")}/book</div>
      </div>
    </>
  );
}
