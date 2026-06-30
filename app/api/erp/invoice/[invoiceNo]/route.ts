import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { renderInvoice } from "@/lib/invoice";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ invoiceNo: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed: string[] = ["SUPER_ADMIN", "ADMIN", "RECEPTION"];
  if (!allowed.includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { invoiceNo } = await params;

  const order = await prisma.salesOrder.findUnique({
    where: { invoiceNo },
    include: {
      lines: true,
      client: { select: { name: true, phone: true, email: true } },
      staff: { select: { name: true } },
      booking: { select: { customerName: true, phone: true, email: true } },
    },
  });

  if (!order) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const bytes = await renderInvoice(order);

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoiceNo}.pdf"`,
    },
  });
}
