import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { answerAssistant, type AssistantInput } from "@/lib/erp-assistant/assistant";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

// The assistant surfaces financial/business data, so it's gated to managers.
// (Subset of FINANCE_ROLES — INVESTOR is intentionally excluded from v1.)
const ALLOWED = ["SUPER_ADMIN", "ADMIN"];

// Simple per-admin burst guard so a stuck client can't loop paid AI calls. Per-instance, which is
// fine for a 2-person admin surface — the role gate is the real throttle.
const WINDOW_MS = 5 * 60_000;
const MAX_PER_WINDOW = 25;
const seen = new Map<string, number[]>();

function overLimit(who: string): boolean {
  const now = Date.now();
  const hits = (seen.get(who) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  seen.set(who, hits);
  if (seen.size > 50) for (const [k, v] of seen) if (!v.some((t) => now - t < WINDOW_MS)) seen.delete(k);
  return hits.length > MAX_PER_WINDOW;
}

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

  // Throttle only the free-form path: that's the one that can spend money on the model. Structured
  // {intent, params} calls never reach the LLM, so counting them would throttle the cheap path and
  // make repeated automated runs fail for no reason.
  // Fail soft (200), not 429 — the panel shows any 200 answer and only special-cases 401/403.
  if (question && overLimit(session.sub ?? session.email ?? "admin")) {
    return NextResponse.json({ answer: "That's a lot of questions at once — give me a minute and try again.", intent: null });
  }

  try {
    const result = await answerAssistant(input);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[assistant] route error:", e);
    // Fail soft: never surface a stack trace; give a calm message.
    return NextResponse.json({ answer: "Sorry, I couldn't answer that just now. Please try again.", intent: null });
  }
}
