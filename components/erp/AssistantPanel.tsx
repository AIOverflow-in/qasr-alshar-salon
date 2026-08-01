"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, X, ArrowUp, GripVertical } from "lucide-react";

type Msg = { role: "user" | "assistant"; text: string };

const POS_KEY = "qa-assistant-pos"; // remembers where the user parked the button
type Pos = { left: number; top: number };

const clampToViewport = (left: number, top: number, w: number, h: number): Pos => ({
  left: Math.min(Math.max(8, left), (typeof window !== "undefined" ? window.innerWidth : 9999) - w - 8),
  top: Math.min(Math.max(8, top), (typeof window !== "undefined" ? window.innerHeight : 9999) - h - 8),
});

const SUGGESTIONS = [
  "What were today's takings?",
  "Top 5 services this month",
  "How many clients came back more than twice this year?",
  "Which artist earns the most per client?",
  "What did I spend on rent in the last 3 months?",
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

  // Draggable, position-remembering FAB — so it never sits on top of pagination or other controls.
  const [pos, setPos] = useState<Pos | null>(null);
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean; last: Pos } | null>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (raw) { const p = JSON.parse(raw) as Pos; setPos(clampToViewport(p.left, p.top, 120, 52)); }
    } catch { /* ignore */ }
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    drag.current = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moved: false, last: { left: r.left, top: r.top } };
    btnRef.current.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d || !btnRef.current) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return; // ignore micro-jitter → still a click
    d.moved = true;
    const r = btnRef.current.getBoundingClientRect();
    d.last = clampToViewport(d.ox + dx, d.oy + dy, r.width, r.height);
    setPos(d.last);
  };
  const endDrag = () => {
    const d = drag.current; drag.current = null;
    if (!d) return;
    if (d.moved) { try { localStorage.setItem(POS_KEY, JSON.stringify(d.last)); } catch { /* ignore */ } }
    else setOpen(true); // a real click (no drag) opens the panel
  };

  // Panel opens anchored to wherever the button was parked (clamped on-screen); default bottom-right.
  const panelStyle: React.CSSProperties = (() => {
    if (!pos || !mounted) return { right: 20, bottom: 20 };
    const w = Math.min(384, window.innerWidth * 0.92), h = Math.min(512, window.innerHeight * 0.8);
    const c = clampToViewport(pos.left, pos.top, w, h);
    return { left: c.left, top: c.top };
  })();

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
      if (res.status === 401 || res.status === 403) {
        // Don't blame the AI for an expired session — say what actually happened.
        setMessages((m) => [...m, { role: "assistant", text: "Your session has expired — please refresh the page and log in again." }]);
        return;
      }
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
          ref={btnRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(true); } }}
          aria-label="Open assistant (drag to move)"
          title="Click to ask · drag to move"
          style={pos && mounted ? { left: pos.left, top: pos.top } : { right: 20, bottom: 20 }}
          className="fixed z-[60] flex touch-none select-none items-center gap-1.5 rounded-full border border-gold/40 bg-ink-card px-4 py-3 text-sm text-gold shadow-2xl hover:border-gold hover:bg-gold/10 cursor-grab active:cursor-grabbing"
        >
          <GripVertical size={14} className="opacity-40" />
          <Sparkles size={18} /> <span className="hidden sm:inline">Ask</span>
        </button>
      )}

      {open && (
        <div style={panelStyle} className="fixed z-[60] flex h-[32rem] max-h-[80vh] w-96 max-w-[92vw] flex-col overflow-hidden rounded-2xl border border-ink-line bg-ink shadow-2xl">
          <div className="flex items-center justify-between border-b border-ink-line px-4 py-3">
            <span className="flex items-center gap-2 font-display text-cream"><Sparkles size={16} className="text-gold" /> Assistant</span>
            <button onClick={() => setOpen(false)} aria-label="Close" className="text-muted hover:text-cream"><X size={16} /></button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted">Ask anything about your salon in plain English — sales, clients, staff, stock, expenses, bookings. I only ever read your data, never change it.</p>
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
