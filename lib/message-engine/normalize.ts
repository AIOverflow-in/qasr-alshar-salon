/** Normalize UAE local numbers and already-international E.164 values. */
export function normalizeE164(input: string | null | undefined): string | null {
  const raw = (input || "").trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+") && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  if (digits.startsWith("971") && digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+971${digits.slice(1)}`;
  return null;
}

export function maskPhone(phone: string) {
  if (phone.length < 6) return "••••";
  return `${phone.slice(0, 4)}••••${phone.slice(-2)}`;
}
