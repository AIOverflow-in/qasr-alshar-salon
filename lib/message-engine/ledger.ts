import type { Booking, MessageChannel, MessageConsent, MessageStatus, Prisma } from "@prisma/client";
import { twilioSender } from "./config";
import { normalizeE164 } from "./normalize";
import type { MessageDb } from "./types";

type BookingMessage = Pick<Booking, "id" | "clientId" | "customerName" | "phone" | "serviceName" | "locale" | "status">;

const CHANNEL: MessageChannel = "WHATSAPP";
const PURPOSE = "VISIT_THANK_YOU" as const;
const MAX_ATTEMPTS = 3;

export function visitThankYouKey(bookingId: string) {
  return `booking:${bookingId}:visit_thank_you:whatsapp`;
}

export async function recordWhatsAppConsent(
  tx: MessageDb,
  clientId: string,
  optedIn: boolean,
  source: string,
  capturedById?: string | null,
) {
  return tx.messageConsent.create({
    data: {
      clientId,
      channel: CHANNEL,
      state: optedIn ? "OPTED_IN" : "OPTED_OUT",
      source,
      capturedById: capturedById || null,
    },
  });
}

async function latestConsent(tx: MessageDb, clientId: string) {
  return tx.messageConsent.findFirst({
    where: { clientId, channel: CHANNEL },
    orderBy: { createdAt: "desc" },
  });
}

function suppressionReason(booking: BookingMessage, recipient: string | null, consent: MessageConsent | null) {
  if (!recipient) return ["INVALID_RECIPIENT", "Customer phone is missing or not a supported UAE number."] as const;
  if (!booking.clientId) return ["NO_CLIENT", "Booking is not linked to a CRM client."] as const;
  if (consent?.state !== "OPTED_IN") return ["NO_CONSENT", "No active WhatsApp opt-in is recorded."] as const;
  return null;
}

export async function queueVisitThankYou(tx: MessageDb, booking: BookingMessage, triggerSource: string) {
  const idempotencyKey = visitThankYouKey(booking.id);
  const existing = await tx.messageLedger.findUnique({ where: { idempotencyKey } });
  if (existing) return existing;

  const recipient = normalizeE164(booking.phone);
  const consent = booking.clientId ? await latestConsent(tx, booking.clientId) : null;
  const suppressed = suppressionReason(booking, recipient, consent);
  const status: MessageStatus = suppressed ? "SUPPRESSED" : "QUEUED";

  return tx.messageLedger.create({
    data: {
      clientId: booking.clientId,
      bookingId: booking.id,
      channel: CHANNEL,
      direction: "OUTBOUND",
      purpose: PURPOSE,
      idempotencyKey,
      provider: "TWILIO",
      recipientE164: recipient || "",
      senderAddress: twilioSender(),
      templateName: "visit_thank_you",
      templateVersion: "v1",
      // English is the only approved template in the MVP; add an Arabic Content SID before switching.
      locale: "en",
      templateVariables: { "1": booking.customerName, "2": booking.serviceName },
      status,
      nextAttemptAt: suppressed ? null : new Date(),
      terminalFailure: !!suppressed,
      consentId: consent?.id || null,
      lastErrorCode: suppressed?.[0] || null,
      lastErrorMessage: suppressed?.[1] || null,
      triggerSource,
    },
  });
}

export async function markClaimed(id: string, now = new Date()) {
  return (await import("@/lib/prisma")).prisma.messageLedger.updateMany({
    where: { id, status: "QUEUED", nextAttemptAt: { lte: now } },
    data: { status: "SUBMITTING", attemptCount: { increment: 1 } },
  });
}

export function retryAt(attemptCount: number, now = new Date()) {
  const delay = Math.min(60 * 60_000, 2 ** Math.max(0, attemptCount - 1) * 60_000);
  return new Date(now.getTime() + delay);
}

export function canRetry(attemptCount: number) {
  return attemptCount < MAX_ATTEMPTS;
}

export const MAX_MESSAGE_ATTEMPTS = MAX_ATTEMPTS;

export function statusRank(status: MessageStatus) {
  return ({ SUPPRESSED: 100, CANCELLED: 100, FAILED: 100, QUEUED: 0, SUBMITTING: 1, SUBMITTED: 2, SENT: 3, DELIVERED: 4, READ: 5 } satisfies Record<MessageStatus, number>)[status];
}

export function twilioStatus(status: string): MessageStatus {
  switch (status.toLowerCase()) {
    case "queued": return "SUBMITTED";
    case "accepted": case "sending": return "SUBMITTED";
    case "sent": return "SENT";
    case "delivered": return "DELIVERED";
    case "read": return "READ";
    case "failed": case "undelivered": return "FAILED";
    default: return "SUBMITTED";
  }
}

export function statusUpdate(status: MessageStatus, now: Date, errorCode?: string | null, errorMessage?: string | null): Prisma.MessageLedgerUpdateInput {
  const data: Prisma.MessageLedgerUpdateInput = { status };
  if (status === "SUBMITTED") data.submittedAt = now;
  if (status === "SENT") data.sentAt = now;
  if (status === "DELIVERED") data.deliveredAt = now;
  if (status === "READ") data.readAt = now;
  if (status === "FAILED") { data.failedAt = now; data.terminalFailure = true; }
  if (errorCode) data.lastErrorCode = errorCode;
  if (errorMessage) data.lastErrorMessage = errorMessage.slice(0, 500);
  return data;
}
