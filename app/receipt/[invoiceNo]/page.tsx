import { Fragment } from "react";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TAX } from "@/lib/tax";
import { SITE } from "@/lib/site";
import { buildReceipt } from "@/lib/receipt-core";
import { code39 } from "@/lib/barcode-core";
import { AutoPrint } from "./AutoPrint";

export const dynamic = "force-dynamic";

// Roles that ring up sales and therefore print receipts.
const POS_ROLES = ["SUPER_ADMIN", "ADMIN", "RECEPTION"];

const intAED = (n: number) => n.toLocaleString("en-AE");
const money2 = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* 80mm thermal receipt, styled to match the salon's established "Sale Receipt".
   To use a 58mm printer instead, change --w and the @page size. */
const CSS = `
  .rc { --w: 80mm; width: var(--w); margin: 0 auto; padding: 4mm 3mm 5mm; box-sizing: border-box;
    color:#000; background:#fff; font-family: var(--font-jost), ui-sans-serif, system-ui, sans-serif;
    font-size: 11px; line-height: 1.35; -webkit-font-smoothing: antialiased;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .rc .serif { font-family: var(--font-playfair), Georgia, serif; }
  .rc .c { text-align:center; }
  .rc .crest { width: 20mm; height:auto; margin: 0 auto 1mm; display:block; }
  .rc .brand { font-size: 20px; font-weight:600; letter-spacing:.02em; }
  .rc .addr { font-size: 10px; margin-top:2px; }
  .rc .title { font-weight:700; font-size:13px; letter-spacing:.06em; padding:4px 0; }
  .rc .box { border:1px solid #000; }
  .rc .bt { border-top:1px solid #000; } .rc .bb { border-bottom:1px solid #000; }
  .rc .info { padding:4px 6px; font-size:10.5px; }
  .rc .info .row { display:flex; gap:6px; }
  .rc .info .row .k { font-weight:700; white-space:nowrap; }
  .rc table { width:100%; border-collapse:collapse; font-size:10.5px; }
  .rc th, .rc td { padding:3px 5px; text-align:right; }
  .rc th:first-child, .rc td:first-child { text-align:left; }
  .rc thead th { border-top:1px solid #000; border-bottom:1px solid #000; font-weight:700; }
  .rc .cat td { text-align:center; font-weight:700; background:#f0f0f0; border-top:1px solid #000; border-bottom:1px solid #000; font-size:10px; }
  .rc .totrow td { border-top:1px solid #000; font-weight:700; }
  .rc .net { display:flex; justify-content:space-between; align-items:center; padding:5px 6px; font-size:15px; font-weight:800; }
  .rc .net .amt { border-top:2px double #000; border-bottom:2px double #000; padding:1px 4px; }
  .rc .paytitle { text-align:center; font-weight:700; padding:3px 0; font-size:11px; }
  .rc .paytot { display:flex; justify-content:space-between; font-weight:800; padding:4px 6px; font-size:12px; border-top:1px solid #000; }
  .rc .bc { margin:8px auto 2px; display:block; }
  .rc .bctext { text-align:center; font-family: ui-monospace, monospace; letter-spacing:.35em; font-size:11px; }
  .rc .foot { text-align:center; font-size:8.5px; color:#333; margin-top:6px; }
  /* globals.css prints only ".print-area" (it hides body * and forces A4 @page{margin:14mm}).
     This thermal receipt uses its own layout, so re-show ".rc" and reclaim the page box. */
  @media print {
    @page { size: 80mm auto; margin: 0; }
    html, body { background:#fff !important; }
    /* globals hides body * and pins .print-area absolute; re-show the receipt in normal flow so
       the 80mm auto-height page sizes to the content (absolute would collapse the page height). */
    .rc, .rc * { visibility: visible !important; }
    .rc { position: static !important; margin: 0 auto; }
    .no-print { display: none !important; }
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
      createdBy: { select: { name: true } },
    },
  });
  if (!order) notFound();

  // Resolve categories: service lines by name → Service.category; product lines by id → Product.category.
  const svcNames = [...new Set(order.lines.filter((l) => l.kind !== "PRODUCT").map((l) => l.description))];
  const prodIds = [...new Set(order.lines.map((l) => l.productId).filter((x): x is string => !!x))];
  const [services, products, staff] = await Promise.all([
    svcNames.length ? prisma.service.findMany({ where: { name: { in: svcNames } }, select: { name: true, category: true } }) : Promise.resolve([]),
    prodIds.length ? prisma.product.findMany({ where: { id: { in: prodIds } }, select: { id: true, category: true } }) : Promise.resolve([]),
    (() => {
      const ids = new Set<string>();
      order.lines.forEach((l) => { (l.staffIds ?? []).forEach((i) => ids.add(i)); if (l.staffId) ids.add(l.staffId); });
      if (order.marketerId) ids.add(order.marketerId);
      return ids.size ? prisma.staff.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true } }) : Promise.resolve([]);
    })(),
  ]);
  const catByName = new Map(services.map((s) => [s.name, s.category]));
  const catByProduct = new Map(products.map((p) => [p.id, p.category]));
  const nameOf = new Map(staff.map((s) => [s.id, s.name]));

  const lines = order.lines.map((l) => ({
    category: l.kind === "PRODUCT" ? (l.productId ? catByProduct.get(l.productId) : null) ?? "Products" : catByName.get(l.description) ?? "Services",
    description: l.description, qty: l.qty, unitAED: l.unitAED, lineAED: l.lineAED,
  }));

  // Sales man = the crown artist(s) who performed; fall back to the marketer.
  const artistNames = [...new Set(
    order.lines.flatMap((l) => (l.staffIds && l.staffIds.length ? l.staffIds : l.staffId ? [l.staffId] : []))
      .map((i) => nameOf.get(i)).filter((n): n is string => !!n),
  )];
  const salesMan = artistNames.join(", ") || (order.marketerId ? nameOf.get(order.marketerId) ?? "" : "");

  const r = buildReceipt(
    {
      invoiceNo: order.invoiceNo, createdAt: order.createdAt, paymentMethod: order.paymentMethod,
      splitPayment: order.splitPayment, cashAED: order.cashAED ?? undefined, cardAED: order.cardAED ?? undefined, transferAED: order.transferAED ?? undefined,
      totalAED: order.totalAED, operatorName: order.createdBy?.name ?? null,
      clientName: order.client?.name ?? order.booking?.customerName ?? null, salesMan, lines,
    },
    { cardBank: SITE.pay.bank },
  );

  const title = TAX.vatRegistered ? "Tax Invoice" : "Sale Receipt";
  const bc = code39(order.invoiceNo, 2, 3);
  const bcH = 42;
  const nowLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }).format(new Date());

  return (
    <>
      <style>{CSS}</style>
      <AutoPrint invoiceNo={order.invoiceNo} />
      <div className="rc">
        {/* Header */}
        <div className="c">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="crest" src="/brand/crest.png" alt="" />
          <div className="brand serif">Qasr Alshar Salon</div>
          <div className="addr">{SITE.address.line1}, {SITE.address.city}</div>
          <div className="addr">{SITE.phones.map((p) => p.label).join(", ")}</div>
        </div>

        <div className="c title bt bb serif">{title}</div>

        {/* Info */}
        <div className="info bb">
          <div className="row"><span className="k">Invoice #</span><span>{r.invoiceNo}</span></div>
          <div className="row"><span className="k">Operator :</span><span>{r.operatorName}</span></div>
          <div className="row"><span className="k">Invoice Date :</span><span>{r.dateLabel}</span></div>
          <div className="row"><span className="k">Client Name :</span><span>{r.clientName}</span></div>
          <div className="row"><span className="k">Sales Man :</span><span>{r.salesMan}</span></div>
        </div>

        {/* Items */}
        <table>
          <thead>
            <tr><th>Item Name</th><th>Price</th><th>Qty</th><th>Amount</th></tr>
          </thead>
          <tbody>
            {r.groups.map((g) => (
              <Fragment key={g.category}>
                <tr className="cat"><td colSpan={4}>{g.category}</td></tr>
                {g.items.map((it, i) => (
                  <tr key={`${g.category}-${i}`}>
                    <td>{it.name}</td><td>{intAED(it.unitAED)}</td><td>{it.qty}</td><td>{intAED(it.lineAED)}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
            <tr className="totrow"><td>Total Items&nbsp;&nbsp;{r.totalItems}</td><td colSpan={2}>Total Qty</td><td>{r.totalQty.toFixed(2)}</td></tr>
          </tbody>
        </table>

        {/* Net amount */}
        <div className="net bb"><span>Net Amount</span><span className="amt">{intAED(r.netAmountAED)}</span></div>

        {/* Payment detail */}
        <div className="paytitle">Payment Detail</div>
        <table>
          <thead><tr><th>Mode</th><th>Bank</th><th>Amount</th></tr></thead>
          <tbody>
            {r.payments.map((p, i) => (
              <tr key={i}><td>{p.mode}</td><td style={{ textAlign: "left" }}>{p.detail || "—"}</td><td>{intAED(p.amountAED)}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="paytot"><span>Total</span><span>{money2(r.totalAED)}</span></div>

        {/* Barcode */}
        <svg className="bc" width="90%" height={bcH} viewBox={`0 0 ${bc.width} ${bcH}`} preserveAspectRatio="none" role="img" aria-label={order.invoiceNo}>
          {bc.bars.map((b, i) => <rect key={i} x={b.x} y={0} width={b.w} height={bcH} fill="#000" />)}
        </svg>
        <div className="bctext">*{order.invoiceNo}*</div>

        {/* Footer */}
        <div className="foot">
          <div>Invoice Date : {r.dateLabel}</div>
          <div>Print Date : {nowLabel}</div>
          {TAX.vatRegistered && <div>VAT TRN {TAX.vatTRN}</div>}
          <div style={{ marginTop: "3px" }}>{SITE.legal.name}</div>
        </div>
      </div>
    </>
  );
}
