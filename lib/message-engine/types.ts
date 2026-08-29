import type { Prisma, PrismaClient } from "@prisma/client";

export type MessageDb = Prisma.TransactionClient | PrismaClient;

export type TwilioSendResult = {
  providerMessageId: string;
  providerStatus: string;
};

export type TwilioSendInput = {
  recipientE164: string;
  customerName: string;
  serviceName: string;
  locale: string;
};

export type DispatchResult = {
  ok: boolean;
  skipped?: string;
  queued?: number;
  sent?: number;
  retried?: number;
  failed?: number;
};
