import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildInvoicePdf } from "@/lib/invoice-pdf";
import { verifyInvoiceToken } from "@/lib/invoice-token";

export const dynamic = "force-dynamic";

/**
 * Public, token-gated invoice PDF — the link we email/WhatsApp to clients.
 * Requires a valid ?t= token; without it the invoice is not accessible here.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ invoiceNo: string }> }
) {
  const { invoiceNo } = await params;
  const token = new URL(req.url).searchParams.get("t") ?? "";

  if (!verifyInvoiceToken(invoiceNo, token)) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 403 });
  }

  const order = await prisma.salesOrder.findUnique({
    where: { invoiceNo },
    include: {
      lines: true,
      client: { select: { name: true, phone: true, email: true } },
      staff: { select: { name: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const bytes = await buildInvoicePdf(order);
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoiceNo}.pdf"`,
    },
  });
}
