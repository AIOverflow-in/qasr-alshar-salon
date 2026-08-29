import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateTwilioSignature } from "@/lib/message-engine/signature";
import { statusRank, statusUpdate, twilioStatus } from "@/lib/message-engine/ledger";
import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";

function eventKey(values: Record<string, string>) {
  const stable = Object.keys(values).sort().map((key) => `${key}=${values[key]}`).join("&");
  return `twilio:${createHash("sha256").update(stable).digest("hex")}`;
}

function providerTime(value: string | undefined) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp);
}

export async function POST(req: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const form = await req.formData();
  const values: Record<string, string> = {};
  for (const [key, value] of form.entries()) if (typeof value === "string") values[key] = value;
  if (!authToken || !validateTwilioSignature(req.url, values, req.headers.get("x-twilio-signature"), authToken)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 403 });
  }

  const providerMessageId = values.MessageSid;
  const rawStatus = values.MessageStatus || values.SmsStatus || "";
  if (!providerMessageId || !rawStatus) return NextResponse.json({ ok: true, ignored: "missing-status" });

  const message = await prisma.messageLedger.findUnique({ where: { providerMessageId } });
  if (!message) return NextResponse.json({ ok: true, ignored: "unknown-message" });

  const normalizedStatus = twilioStatus(rawStatus);
  const key = eventKey(values);
  const receivedAt = new Date();
  const occurredAt = providerTime(values.Timestamp);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.messageEvent.create({
        data: {
          messageLedgerId: message.id,
          providerEventKey: key,
          providerMessageId,
          eventType: "STATUS_CALLBACK",
          normalizedStatus,
          providerStatus: rawStatus,
          occurredAt,
          receivedAt,
          errorCode: values.ErrorCode || null,
          errorMessage: values.ErrorMessage?.slice(0, 500) || null,
          payload: {
            MessageSid: providerMessageId,
            MessageStatus: rawStatus,
            Timestamp: values.Timestamp || null,
            ErrorCode: values.ErrorCode || null,
          },
        },
      });
      const current = await tx.messageLedger.findUnique({ where: { id: message.id }, select: { status: true } });
      if (current && statusRank(normalizedStatus) > statusRank(current.status)) {
        // Conditional update prevents an out-of-order callback from moving a later status backwards.
        await tx.messageLedger.updateMany({
          where: { id: message.id, status: current.status },
          data: statusUpdate(normalizedStatus, occurredAt || receivedAt, values.ErrorCode, values.ErrorMessage),
        });
      }
    });
  } catch (e) {
    const err = e as { code?: string };
    if (err.code !== "P2002") throw e; // duplicate callback: safely acknowledged
  }
  return NextResponse.json({ ok: true });
}
