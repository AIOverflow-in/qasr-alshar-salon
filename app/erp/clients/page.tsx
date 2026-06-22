import { prisma } from "@/lib/prisma";
import { aed } from "@/lib/utils";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ErpClients() {
  const clients = await prisma.client.findMany({ orderBy: { updatedAt: "desc" }, take: 100 });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-cream">Clients</h1>
      {clients.length === 0 ? (
        <div className="surface rounded-2xl p-10 text-center">
          <Users className="mx-auto text-gold" size={32} />
          <p className="mt-3 text-cream">No client records yet.</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Clients are auto-created from bookings and the POS. The CRM slice adds hair-type/porosity,
            visit history, notes, consent and aftercare recommendations.
          </p>
        </div>
      ) : (
        <div className="surface overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-ink-line text-left text-muted">
              <tr><th className="p-3 font-medium">Name</th><th className="p-3 font-medium">Phone</th><th className="p-3 font-medium">Hair</th><th className="p-3 font-medium">Visits</th><th className="p-3 font-medium">Spent</th></tr>
            </thead>
            <tbody className="divide-y divide-ink-line/60">
              {clients.map((c) => (
                <tr key={c.id}>
                  <td className="p-3 text-cream">{c.name}</td>
                  <td className="p-3 text-muted">{c.phone ?? "—"}</td>
                  <td className="p-3 text-sand">{c.hairType ?? "—"}</td>
                  <td className="p-3 text-sand">{c.visits}</td>
                  <td className="p-3 text-cream">{aed(c.totalSpentAED)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
