import "server-only";
import { prisma } from "./prisma";
import { buildInvoicePdf } from "./invoice-pdf";

type OrderLineLike = { description: string; qty: number; unitAED: number; lineAED: number; staffId?: string | null; staffIds?: string[] };
type OrderLike = {
  invoiceNo: string; createdAt: Date; paymentMethod: string; status: string;
  subtotalAED: number; vatPct: number; vatAED: number; totalAED: number; notes: string | null;
  lines: OrderLineLike[];
  client: { name: string; phone: string | null; email: string | null } | null;
  staff: { name: string } | null;
};

/** Build the invoice PDF, resolving each line's artist id(s) to display names. */
export async function renderInvoice(order: OrderLike): Promise<Uint8Array> {
  const ids = new Set<string>();
  for (const l of order.lines) {
    (l.staffIds ?? []).forEach((i) => ids.add(i));
    if (l.staffId) ids.add(l.staffId);
  }
  const staff = ids.size ? await prisma.staff.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true } }) : [];
  const nameOf = new Map(staff.map((s) => [s.id, s.name]));

  const lines = order.lines.map((l) => {
    const sids = l.staffIds && l.staffIds.length ? l.staffIds : l.staffId ? [l.staffId] : [];
    return {
      description: l.description, qty: l.qty, unitAED: l.unitAED, lineAED: l.lineAED,
      staffNames: sids.map((i) => nameOf.get(i)).filter((n): n is string => !!n),
    };
  });

  return buildInvoicePdf({ ...order, lines });
}
