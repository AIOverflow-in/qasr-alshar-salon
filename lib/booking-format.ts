/**
 * Booking text formatting — clean service lists + WhatsApp messages.
 * Pure (no server-only): safe to import from client components and API routes.
 */

/** Comma-joined full service list, e.g. "Box Braids, Deep Conditioning, Henna". */
export function serviceListText(names: string[]): string {
  return names.filter(Boolean).join(", ");
}

const bullets = (names: string[]) => names.filter(Boolean).map((s) => `• ${s}`).join("\n");

function whereLine(serviceMode?: string | null, address?: string | null) {
  return serviceMode === "HOME"
    ? `Where: Home service${address ? ` — ${address}` : ""}`
    : "Where: At the salon (Union Metro, Deira)";
}

/** Client → salon, from the public booking success screen. */
export function clientBookingMessage(o: { services: string[]; whenLabel: string; ref?: string | null }): string {
  return [
    `Hi Qasr Alshar! I just booked${o.ref ? ` (ref ${o.ref})` : ""}:`,
    bullets(o.services),
    ``,
    `When: ${o.whenLabel}`,
  ].join("\n");
}

/** Salon → client confirmation. */
export function salonToClientMessage(o: { customerName: string; services: string[]; whenLabel: string; serviceMode?: string | null; address?: string | null; ref?: string | null }): string {
  return [
    `Hello ${o.customerName} 👑`,
    `Your Qasr Alshar booking is confirmed${o.ref ? ` (ref ${o.ref})` : ""}:`,
    ``,
    `Services:`,
    bullets(o.services),
    ``,
    `When: ${o.whenLabel}`,
    whereLine(o.serviceMode, o.address),
    ``,
    `See you soon! Reply here if you need to change anything.`,
  ].join("\n");
}

/** Salon → Crown Artist reminder. */
export function artistReminderMessage(o: { artistName: string; customerName: string; services: string[]; whenLabel: string; serviceMode?: string | null; address?: string | null }): string {
  return [
    `Hi ${o.artistName}, reminder of your upcoming booking:`,
    ``,
    `Client: ${o.customerName}`,
    `Services:`,
    bullets(o.services),
    `When: ${o.whenLabel}`,
    whereLine(o.serviceMode, o.address),
  ].join("\n");
}
