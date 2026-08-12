/**
 * Pure team-performance ranking, derived from data getPayrollMonth already loads — so the panel
 * costs no extra queries. Built for the 11 Aug meeting: Jacqueline wanted to show an artist their
 * actual numbers rather than argue about them.
 */

export type PerfInput = { staffId: string; name: string; role: string; active: boolean; clientsServed: number; grossAED: number };

export type PerfRow = {
  staffId: string;
  name: string;
  role: string;
  rank: number;
  clientsServed: number;
  revenueAED: number;
  perClientAED: number;   // average spend per client served
  sharePct: number;       // share of the team's revenue, one decimal
  vsAveragePct: number;   // +/- % against the team average (0 when there's no average)
};

export type PerfSummary = {
  rows: PerfRow[];
  totalRevenueAED: number;
  totalClients: number;
  averageRevenueAED: number;
  activeCount: number;
};

/** Rank active artists by revenue. Anyone with no activity is dropped — a list of zeroes helps nobody. */
export function buildPerformance(staff: PerfInput[]): PerfSummary {
  const working = staff.filter((s) => s.active && (s.grossAED > 0 || s.clientsServed > 0));
  const totalRevenueAED = working.reduce((t, s) => t + s.grossAED, 0);
  const totalClients = working.reduce((t, s) => t + s.clientsServed, 0);
  const averageRevenueAED = working.length ? Math.round(totalRevenueAED / working.length) : 0;

  const rows = [...working]
    .sort((a, b) => b.grossAED - a.grossAED || b.clientsServed - a.clientsServed)
    .map((s, i) => ({
      staffId: s.staffId,
      name: s.name,
      role: s.role,
      rank: i + 1,
      clientsServed: s.clientsServed,
      revenueAED: s.grossAED,
      perClientAED: s.clientsServed > 0 ? Math.round(s.grossAED / s.clientsServed) : 0,
      sharePct: totalRevenueAED > 0 ? Math.round((s.grossAED / totalRevenueAED) * 1000) / 10 : 0,
      vsAveragePct: averageRevenueAED > 0 ? Math.round(((s.grossAED - averageRevenueAED) / averageRevenueAED) * 100) : 0,
    }));

  return { rows, totalRevenueAED, totalClients, averageRevenueAED, activeCount: working.length };
}
