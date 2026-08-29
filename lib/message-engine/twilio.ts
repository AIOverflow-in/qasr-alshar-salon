import "server-only";
import { twilioContentSid, twilioSender } from "./config";
import type { TwilioSendInput, TwilioSendResult } from "./types";

export class TwilioError extends Error {
  constructor(public readonly code: string, message: string, public readonly retryable: boolean) {
    super(message);
    this.name = "TwilioError";
  }
}

function address(value: string) {
  return value.startsWith("whatsapp:") ? value : `whatsapp:${value}`;
}

export async function sendVisitThankYou(input: TwilioSendInput): Promise<TwilioSendResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKeySid = process.env.TWILIO_API_KEY_SID || accountSid;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET || process.env.TWILIO_AUTH_TOKEN;
  const sender = twilioSender();
  const contentSid = twilioContentSid();
  const callback = process.env.TWILIO_STATUS_CALLBACK_URL;
  if (!accountSid || !apiKeySid || !apiKeySecret || !sender || !contentSid || !callback) {
    throw new TwilioError("TWILIO_NOT_CONFIGURED", "Twilio message configuration is incomplete.", false);
  }

  const body = new URLSearchParams({
    From: address(sender),
    To: address(input.recipientE164),
    ContentSid: contentSid,
    ContentVariables: JSON.stringify({ "1": input.customerName, "2": input.serviceName }),
    StatusCallback: callback,
  });
  const auth = Buffer.from(`${apiKeySid}:${apiKeySecret}`).toString("base64");
  let response: Response;
  try {
    response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    throw new TwilioError("TWILIO_NETWORK", e instanceof Error ? e.message : "Twilio request failed.", true);
  }

  const payload = await response.json().catch(() => ({})) as { sid?: string; status?: string; code?: number | string; message?: string };
  if (!response.ok || !payload.sid) {
    const code = String(payload.code ?? `HTTP_${response.status}`);
    const retryable = response.status === 429 || response.status >= 500;
    throw new TwilioError(code, String(payload.message || "Twilio rejected the message."), retryable);
  }
  return { providerMessageId: payload.sid, providerStatus: payload.status || "queued" };
}
