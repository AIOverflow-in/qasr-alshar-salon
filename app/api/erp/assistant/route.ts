import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { answerAssistant, type AssistantInput } from "@/lib/erp-assistant/assistant";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// The assistant surfaces financial/business data, so it's gated to managers.
// (Subset of FINANCE_ROLES — INVESTOR is intentionally excluded from v1.)
const ALLOWED = ["SUPER_ADMIN", "ADMIN"];

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED.includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { body = {}; }

  const question = typeof body.question === "string" ? body.question.trim().slice(0, 500) : "";
  const intent = typeof body.intent === "string" ? body.intent : "";
  const input: AssistantInput | null = question
    ? { question }
    : intent
      ? { intent, params: (body.params as Record<string, unknown>) ?? {} }
      : null;

  if (!input) return NextResponse.json({ error: "Ask a question." }, { status: 400 });

  try {
    const result = await answerAssistant(input);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[assistant] route error:", e);
    // Fail soft: never surface a stack trace; give a calm message.
    return NextResponse.json({ answer: "Sorry, I couldn't answer that just now. Please try again.", intent: null });
  }
}
