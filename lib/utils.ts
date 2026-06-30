import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalize a phone to international digits for wa.me (default country UAE = 971).
 * "0501193606" → "971501193606", "00971…" → "971…", "501193606" → "971501193606".
 * Numbers that already carry a country code (e.g. "971…", "233…") are kept as-is.
 */
export function normalizePhoneIntl(phone: string, defaultCC = "971"): string {
  let n = (phone ?? "").replace(/[^0-9]/g, "");
  if (!n) return "";
  if (n.startsWith("00")) n = n.slice(2);                 // drop intl "00" prefix
  if (n.startsWith("0")) return defaultCC + n.slice(1);   // local trunk 0 → country code
  if (n.startsWith(defaultCC)) return n;                  // already this country
  if (n.length <= 9) return defaultCC + n;                // bare local subscriber number
  return n;                                               // already international (other country)
}

/** Build a wa.me deep link with a pre-filled message. */
export function whatsappLink(phone: string, message?: string) {
  const num = normalizePhoneIntl(phone);
  const base = `https://wa.me/${num}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** AED price formatter. */
export function aed(amount: number, plus = false) {
  return `AED ${amount}${plus ? "+" : ""}`;
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
