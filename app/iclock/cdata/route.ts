import { prisma } from "@/lib/prisma";
import { parseAttlog, handshakeResponse } from "@/lib/attendance-core";

export const dynamic = "force-dynamic";

// Only accept pushes from known device serials. Empty allowlist = accept any (for first-time setup);
// set BIOMETRIC_DEVICE_SNS=<sn> in production once the device is connected to lock it down.
function snAllowed(sn: string | null): sn is string {
  if (!sn) return false;
  const allow = (process.env.BIOMETRIC_DEVICE_SNS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return allow.length === 0 || allow.includes(sn);
}
const text = (body: string, status = 200) => new Response(body, { status, headers: { "Content-Type": "text/plain" } });

// ZKTeco ADMS handshake: the terminal fetches its options on connect.
export async function GET(req: Request) {
  const sn = new URL(req.url).searchParams.get("SN");
  if (!snAllowed(sn)) return text("", 401);
  return text(handshakeResponse(sn));
}

// ZKTeco ADMS push: the terminal POSTs records. table=ATTLOG carries punches; other tables are ack'd + ignored.
export async function POST(req: Request) {
  const url = new URL(req.url);
  const sn = url.searchParams.get("SN");
  if (!snAllowed(sn)) return text("", 401);

  const table = (url.searchParams.get("table") || "").toUpperCase();
  let body = "";
  try { body = await req.text(); } catch { body = ""; }
  if (table && table !== "ATTLOG") return text("OK"); // operlog / user data etc. — acknowledge, don't store

  const punches = parseAttlog(body);
  if (punches.length) {
    const pins = [...new Set(punches.map((p) => p.pin))];
    const staff = await prisma.staff.findMany({ where: { biometricPin: { in: pins } }, select: { id: true, biometricPin: true } });
    const byPin = new Map(staff.map((s) => [s.biometricPin!, s.id]));
    try {
      await prisma.attendancePunch.createMany({
        data: punches.map((p) => ({ deviceSn: sn, pin: p.pin, staffId: byPin.get(p.pin) ?? null, punchedAt: p.punchedAt, status: p.status, verifyMode: p.verifyMode, raw: p.raw })),
        skipDuplicates: true, // idempotent — the device re-sends unacked records
      });
    } catch (e) {
      console.error("[iclock] punch ingest failed:", e);
      // still ack so the device doesn't wedge retrying; we can backfill from `raw` logs if needed.
    }
  }
  return text("OK"); // the terminal needs a plain-text OK to mark records delivered
}
