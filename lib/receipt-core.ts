// Pure receipt assembly for the thermal (80mm) printout — no DB/env, so it's unit-tested and
// reused by the receipt page. The VAT-registered flag is passed in (from lib/tax.ts) so this stays pure.
import { aed } from "./utils";

export type ReceiptLine = { description: string; qty: number; unitAED: number; lineAED: number; staffNames?: string[] };

export type ReceiptInput = {
  invoiceNo: string;
  createdAt: Date;
  paymentMethod: string;
  splitPayment?: boolean;
  cashAED?: number;
  cardAED?: number;
  transferAED?: number;
  subtotalAED: number;
  vatAED: number;
  vatPct: number;
  totalAED: number;
  lines: ReceiptLine[];
  clientName?: string | null;
};

export type Receipt = {
  invoiceNo: string;
  dateLabel: string;
  clientName: string;
  items: { name: string; qty: number; unitAED: number; lineAED: number; by?: string }[];
  itemCount: number;
  showVat: boolean; // VAT breakdown shown only once VAT-registered
  subtotalAED: number;
  vatAED: number;
  vatPct: number;
  totalAED: number;
  paymentLabel: string;
};

/** Dubai-local date + time for the receipt header. */
export function receiptDateLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(d);
}

/** Human payment label: a single method, or the split broken down by method + amount. */
export function paymentLabel(o: Pick<ReceiptInput, "splitPayment" | "paymentMethod" | "cashAED" | "cardAED" | "transferAED">): string {
  if (o.splitPayment) {
    const parts = ([["Cash", o.cashAED], ["Card", o.cardAED], ["Transfer", o.transferAED]] as const)
      .filter(([, v]) => (v ?? 0) > 0)
      .map(([k, v]) => `${k} ${aed(v as number)}`);
    return parts.length ? `Split — ${parts.join(" · ")}` : "Split";
  }
  const m = (o.paymentMethod || "CASH").trim();
  return m ? m.charAt(0).toUpperCase() + m.slice(1).toLowerCase() : "Cash";
}

export function buildReceipt(o: ReceiptInput, vatRegistered: boolean): Receipt {
  const items = o.lines.map((l) => ({
    name: l.description,
    qty: l.qty,
    unitAED: l.unitAED,
    lineAED: l.lineAED,
    by: (l.staffNames ?? []).filter(Boolean).join(", ") || undefined,
  }));
  return {
    invoiceNo: o.invoiceNo,
    dateLabel: receiptDateLabel(o.createdAt),
    clientName: (o.clientName ?? "").trim() || "Walk-in customer",
    items,
    itemCount: items.reduce((s, i) => s + i.qty, 0),
    showVat: vatRegistered,
    subtotalAED: o.subtotalAED,
    vatAED: o.vatAED,
    vatPct: o.vatPct,
    totalAED: o.totalAED,
    paymentLabel: paymentLabel(o),
  };
}
