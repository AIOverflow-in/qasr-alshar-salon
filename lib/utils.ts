import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Build a wa.me deep link with a pre-filled message. */
export function whatsappLink(phone: string, message?: string) {
  const num = phone.replace(/[^0-9]/g, "");
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
