import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { dubaiMonthRange, currentDubaiMonth } from "@/lib/payroll";
import { expenseWhere } from "@/lib/expense-filter";
import { csvCell as csv, csvFile } from "@/lib/csv-core";

export const dynamic = "force-dynamic";

const dtFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", day: "2-digit", month: "short", year: "numeric" });

/** CSV of the filtered expenses for a month (respects the reception privacy scope). */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["SUPER_ADMIN", "ADMIN", "RECEPTION"].includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const isManager = session.role === "SUPER_ADMIN" || session.role === "ADMIN";

  const url = new URL(req.url);
  const month = /^\d{4}-\d{2}$/.test(url.searchParams.get("month") ?? "") ? url.searchParams.get("month")! : currentDubaiMonth();
  const { start, end } = dubaiMonthRange(month);
  const where = expenseWhere({ isManager, userId: session.sub, start, end, category: url.searchParams.get("category"), q: url.searchParams.get("q") });

  const expenses = await prisma.expense.findMany({
    where, orderBy: { incurredOn: "desc" },
    select: { incurredOn: true, category: true, description: true, invoiceNo: true, amountAED: true, receiptUrl: true, receiptUrls: true, createdById: true },
  });

  // createdById is a plain id (no relation) — resolve the logger names in one query.
  const ids = [...new Set(expenses.map((e) => e.createdById).filter((v): v is string => !!v))];
  const users = ids.length ? await prisma.adminUser.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
  const nameOf = new Map(users.map((u) => [u.id, u.name] as const));

  const header = ["Date", "Category", "Description", "Invoice #", "Amount (AED)", "Logged by", "Receipt"];
  const rows = expenses.map((e) => [
    dtFmt.format(e.incurredOn),
    e.category,
    e.description,
    e.invoiceNo ?? "",
    e.amountAED,
    e.createdById ? (nameOf.get(e.createdById) ?? "") : "",
    e.receiptUrls?.length ? e.receiptUrls.join(" | ") : (e.receiptUrl ?? ""),
  ].map(csv).join(","));
  const total = expenses.reduce((s, e) => s + e.amountAED, 0);
  // TOTAL in the first column — sitting in "Invoice #" it looked like an invoice number.
  rows.push(["TOTAL", "", "", "", total, "", ""].map(csv).join(","));

  return new Response(csvFile([header.join(","), ...rows]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="expenses-${month}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
