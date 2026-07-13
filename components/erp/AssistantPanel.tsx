"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, X, ArrowUp } from "lucide-react";

type Msg = { role: "user" | "assistant"; text: string };

const SUGGESTIONS = [
  "What were today's takings?",
  "Top 5 services this month",
  "Which products are low on stock?",
  "Who was my best stylist this month?",
];

/** Render the assistant's lightweight markdown (**bold** + line breaks) safely — no HTML injection. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <span key={i} className="block">
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
            part.startsWith("**") && part.endsWith("**")
              ? <strong key={j} className="text-cream">{part.slice(2, -2)}</strong>
              : <span key={j}>{part}</span>,
          )}
        </span>
      ))}
    </>
  );
}

export function AssistantPanel() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const ask = useCallback(async (question: string) => {
    const q = question.trim();
    if (!q || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setLoading(true);
    try {
      const res = await fetch("/api/erp/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json().catch(() => ({}));
      const answer = typeof data.answer === "string" && data.answer ? data.answer : "Sorry, I couldn't answer that.";
      setMessages((m) => [...m, { role: "assistant", text: answer }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open assistant"
          className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-full border border-gold/40 bg-ink-card px-4 py-3 text-sm text-gold shadow-2xl hover:border-gold hover:bg-gold/10"
        >
          <Sparkles size={18} /> <span className="hidden sm:inline">Ask</span>
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-[60] flex h-[32rem] max-h-[80vh] w-96 max-w-[92vw] flex-col overflow-hidden rounded-2xl border border-ink-line bg-ink shadow-2xl">
          <div className="flex items-center justify-between border-b border-ink-line px-4 py-3">
            <span className="flex items-center gap-2 font-display text-cream"><Sparkles size={16} className="text-gold" /> Assistant</span>
            <button onClick={() => setOpen(false)} aria-label="Close" className="text-muted hover:text-cream"><X size={16} /></button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted">Ask about your salon in plain English — takings, top services, staff, stock, expenses, bookings.</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => ask(s)} className="rounded-full border border-ink-line px-3 py-1.5 text-xs text-sand hover:border-gold/50 hover:text-gold">{s}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={m.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-sm bg-gold/15 px-3 py-2 text-sm text-cream"
                  : "max-w-[90%] rounded-2xl rounded-bl-sm bg-ink-card px-3 py-2 text-sm leading-relaxed text-sand"}>
                  <Rich text={m.text} />
                </div>
              </div>
            ))}
            {loading && <div className="flex justify-start"><div className="rounded-2xl bg-ink-card px-3 py-2 text-sm text-muted">Thinking…</div></div>}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); ask(input); }}
            className="flex items-center gap-2 border-t border-ink-line p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              className="min-w-0 flex-1 rounded-full border border-ink-line bg-ink-card px-4 py-2 text-sm text-cream placeholder:text-muted focus:border-gold/50 focus:outline-none"
            />
            <button type="submit" disabled={loading || !input.trim()} aria-label="Send" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold text-espresso disabled:opacity-40">
              <ArrowUp size={18} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
