import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { maskPhone } from "@/lib/message-engine/normalize";

export const dynamic = "force-dynamic";

const statusClass: Record<string, string> = {
  QUEUED: "text-gold", SUBMITTING: "text-gold", SUBMITTED: "text-blue-300", SENT: "text-blue-300",
  DELIVERED: "text-green-400", READ: "text-green-400", FAILED: "text-red-400", SUPPRESSED: "text-muted", CANCELLED: "text-muted",
};

function when(d: Date) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", dateStyle: "medium", timeStyle: "short" }).format(d);
}

export default async function ErpMessages() {
  if (!(await requireRole(["SUPER_ADMIN", "ADMIN", "RECEPTION"]))) redirect("/erp");
  const messages = await prisma.messageLedger.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      client: { select: { name: true } },
      booking: { select: { id: true, customerName: true } },
      salesOrder: { select: { invoiceNo: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-cream">Messages</h1>
        <p className="text-sm text-muted">WhatsApp delivery ledger · latest 100 messages</p>
      </div>
      <div className="surface overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="border-b border-ink-line text-left text-muted">
            <tr>
              <th className="p-4 font-medium">Created</th>
              <th className="p-4 font-medium">Client</th>
              <th className="p-4 font-medium">Purpose</th>
              <th className="p-4 font-medium">Destination</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">Provider ID</th>
              <th className="p-4 font-medium">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-line/60">
            {messages.map((m) => (
              <tr key={m.id}>
                <td className="p-4 whitespace-nowrap text-muted">{when(m.createdAt)}</td>
                <td className="p-4 text-cream">{m.client?.name || m.booking?.customerName || "Unknown"}</td>
                <td className="p-4 text-sand">{m.purpose.replaceAll("_", " ")}</td>
                <td className="p-4 font-mono text-xs text-muted">{m.recipientE164 ? maskPhone(m.recipientE164) : "—"}</td>
                <td className={`p-4 font-semibold ${statusClass[m.status] || "text-muted"}`}>{m.status}</td>
                <td className="p-4 font-mono text-xs text-muted">{m.providerMessageId || "—"}</td>
                <td className="max-w-xs p-4 text-xs text-red-300">{m.lastErrorCode || m.lastErrorMessage || "—"}</td>
              </tr>
            ))}
            {!messages.length && <tr><td colSpan={7} className="p-10 text-center text-muted">No messages have been queued.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
