export const dynamic = "force-dynamic";

// The ZKTeco terminal polls this for queued commands. We're receive-only, so we always answer "OK"
// (no command). Gated on the device serial like the cdata endpoint.
function snAllowed(sn: string | null): boolean {
  if (!sn) return false;
  const allow = (process.env.BIOMETRIC_DEVICE_SNS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return allow.length === 0 || allow.includes(sn);
}

export async function GET(req: Request) {
  const sn = new URL(req.url).searchParams.get("SN");
  if (!snAllowed(sn)) return new Response("", { status: 401 });
  return new Response("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
}
