// Pure receipt assembly for the thermal (80mm) printout — no DB/env, so it's unit-tested and
// reused by the receipt page. Mirrors the salon's established "Sale Receipt" layout: header info
// (invoice/operator/date/client/salesman), items grouped by category, totals, and a payment
// detail table. VAT is only broken out once the salon is VAT-registered (passed in).

export type ReceiptLineInput = {
  category?: string | null; // service/product category → section header (e.g. "Hair")
  description: string;
  qty: number;
  unitAED: number;
  lineAED: number;
};

export type ReceiptInput = {
  invoiceNo: string;
  createdAt: Date;
  paymentMethod: string;
  splitPayment?: boolean;
  cashAED?: number;
  cardAED?: number;
  transferAED?: number;
  totalAED: number;
  operatorName?: string | null; // cashier who rang up the bill
  clientName?: string | null;
  salesMan?: string | null; // artist(s) / marketer
  cardBank?: string; // acquiring bank shown against card/transfer payments
  lines: ReceiptLineInput[];
};

export type ReceiptItem = { name: string; unitAED: number; qty: number; lineAED: number };
export type ReceiptGroup = { category: string; items: ReceiptItem[] };
export type ReceiptPayment = { mode: string; detail: string; amountAED: number };

export type Receipt = {
  invoiceNo: string;
  operatorName: string;
  dateLabel: string;
  clientName: string;
  salesMan: string;
  groups: ReceiptGroup[];
  totalItems: number;
  totalQty: number;
  netAmountAED: number;
  payments: ReceiptPayment[];
  totalAED: number;
};

const titleCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);

/** Dubai-local "Sun, 26 Apr 2026, 12:37 AM" for the receipt header. */
export function receiptDateLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai", weekday: "short", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(d);
}

/** Payment-detail rows: one per method with a non-zero amount (or the single method for the whole total). */
export function paymentRows(o: Pick<ReceiptInput, "splitPayment" | "paymentMethod" | "cashAED" | "cardAED" | "transferAED" | "totalAED">, cardBank = ""): ReceiptPayment[] {
  const modeLabel = (m: string) => (m === "CARD" ? "Credit Card" : titleCase(m));
  const detailFor = (m: string) => (m === "CARD" || m === "TRANSFER" ? cardBank : "");
  if (o.splitPayment) {
    return ([["CASH", o.cashAED], ["CARD", o.cardAED], ["TRANSFER", o.transferAED]] as const)
      .filter(([, v]) => (v ?? 0) > 0)
      .map(([m, v]) => ({ mode: modeLabel(m), detail: detailFor(m), amountAED: v as number }));
  }
  const m = (o.paymentMethod || "CASH").toUpperCase();
  return [{ mode: modeLabel(m), detail: detailFor(m), amountAED: o.totalAED }];
}

export function buildReceipt(o: ReceiptInput, opts?: { cardBank?: string }): Receipt {
  const cardBank = opts?.cardBank ?? o.cardBank ?? "";
  // Group lines by category, preserving the order categories first appear.
  const seen: string[] = [];
  const byCat = new Map<string, ReceiptItem[]>();
  for (const l of o.lines) {
    const cat = (l.category ?? "").trim() || "Other";
    if (!byCat.has(cat)) { byCat.set(cat, []); seen.push(cat); }
    byCat.get(cat)!.push({ name: l.description, unitAED: l.unitAED, qty: l.qty, lineAED: l.lineAED });
  }
  return {
    invoiceNo: o.invoiceNo,
    operatorName: (o.operatorName ?? "").trim() || "—",
    dateLabel: receiptDateLabel(o.createdAt),
    clientName: (o.clientName ?? "").trim() || "Walk-In",
    salesMan: (o.salesMan ?? "").trim() || "—",
    groups: seen.map((c) => ({ category: c, items: byCat.get(c)! })),
    totalItems: o.lines.length,
    totalQty: o.lines.reduce((s, l) => s + l.qty, 0),
    netAmountAED: o.totalAED,
    payments: paymentRows(o, cardBank),
    totalAED: o.totalAED,
  };
}
