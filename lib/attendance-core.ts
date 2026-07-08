// Pure, dependency-free ZKTeco ADMS (push protocol) helpers — unit-tested in attendance-core.test.ts.

export type ParsedPunch = { pin: string; punchedAt: Date; status: string | null; verifyMode: string | null; raw: string };

/** Device timestamps are local wall-clock; the salon is Asia/Dubai (fixed +04:00, no DST). */
function parseDeviceTime(s: string): Date | null {
  const m = String(s).trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const dt = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+04:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/**
 * Parse a ZKTeco ADMS ATTLOG body into punches. Records are one-per-line, tab-separated:
 *   PIN \t YYYY-MM-DD HH:MM:SS \t status \t verifyMode \t [workcode…]
 * Tolerant of \r\n line endings and malformed/short lines (skipped, never throws).
 */
export function parseAttlog(body: string): ParsedPunch[] {
  const out: ParsedPunch[] = [];
  for (const line of String(body ?? "").split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw) continue;
    const f = raw.split("\t");
    if (f.length < 2) continue;
    const pin = f[0].trim();
    const punchedAt = parseDeviceTime(f[1]);
    if (!pin || !punchedAt) continue;
    out.push({ pin, punchedAt, status: f[2]?.trim() || null, verifyMode: f[3]?.trim() || null, raw });
  }
  return out;
}

/** Config text returned on the device's initial GET /iclock/cdata handshake (enables realtime push). */
export function handshakeResponse(sn: string): string {
  return [
    `GET OPTION FROM: ${sn}`,
    "Stamp=9999",
    "OpStamp=9999",
    "ErrorDelay=30",
    "Delay=30",
    "TransTimes=00:00;14:05",
    "TransInterval=1",
    "TransFlag=111111111",
    "Realtime=1",
    "Encrypt=0",
  ].join("\n") + "\n";
}
