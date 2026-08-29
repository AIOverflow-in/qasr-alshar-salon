import { prisma } from "@/lib/prisma";
import { messageEngineDryRun, messageEngineEnabled, isDispatchOwner } from "./config";
import { canRetry, markClaimed, retryAt } from "./ledger";
import { sendVisitThankYou, TwilioError } from "./twilio";
import type { DispatchResult } from "./types";

const BATCH_SIZE = 20;

export async function dispatchMessages(): Promise<DispatchResult> {
  if (!messageEngineEnabled()) return { ok: true, skipped: "disabled" };
  if (!isDispatchOwner()) return { ok: true, skipped: "not-owner" };
  if (messageEngineDryRun()) return { ok: true, skipped: "dry-run" };

  const now = new Date();
  const candidates = await prisma.messageLedger.findMany({
    where: { status: "QUEUED", nextAttemptAt: { lte: now }, terminalFailure: false, channel: "WHATSAPP", purpose: "VISIT_THANK_YOU" },
    orderBy: { queuedAt: "asc" },
    take: BATCH_SIZE,
  });

  let sent = 0, retried = 0, failed = 0;
  for (const candidate of candidates) {
    if ((await markClaimed(candidate.id)).count === 0) continue;
    const message = await prisma.messageLedger.findUnique({ where: { id: candidate.id } });
    if (!message) continue;

    const consent = message.clientId
      ? await prisma.messageConsent.findFirst({ where: { clientId: message.clientId, channel: "WHATSAPP" }, orderBy: { createdAt: "desc" } })
      : null;
    if (consent?.state !== "OPTED_IN") {
      await prisma.messageLedger.update({ where: { id: message.id }, data: { status: "SUPPRESSED", terminalFailure: true, nextAttemptAt: null, consentId: consent?.id || null, lastErrorCode: "NO_CONSENT", lastErrorMessage: "WhatsApp opt-in was not active at dispatch time." } });
      continue;
    }

    try {
      const variables = (message.templateVariables || {}) as { "1"?: string; "2"?: string };
      const result = await sendVisitThankYou({
        recipientE164: message.recipientE164,
        customerName: variables["1"] || "there",
        serviceName: variables["2"] || "service",
        locale: message.locale,
      });
      await prisma.messageLedger.update({ where: { id: message.id }, data: { providerMessageId: result.providerMessageId, status: "SUBMITTED", submittedAt: new Date(), lastErrorCode: null, lastErrorMessage: null } });
      sent++;
    } catch (e) {
      const error = e instanceof TwilioError ? e : new TwilioError("MESSAGE_SEND_FAILED", e instanceof Error ? e.message : "Message send failed.", true);
      const attemptCount = message.attemptCount;
      if (error.retryable && canRetry(attemptCount)) {
        await prisma.messageLedger.update({ where: { id: message.id }, data: { status: "QUEUED", nextAttemptAt: retryAt(attemptCount), lastErrorCode: error.code, lastErrorMessage: error.message.slice(0, 500) } });
        retried++;
      } else {
        await prisma.messageLedger.update({ where: { id: message.id }, data: { status: "FAILED", failedAt: new Date(), terminalFailure: true, nextAttemptAt: null, lastErrorCode: error.code, lastErrorMessage: error.message.slice(0, 500) } });
        failed++;
      }
    }
  }
  return { ok: true, queued: candidates.length, sent, retried, failed };
}
