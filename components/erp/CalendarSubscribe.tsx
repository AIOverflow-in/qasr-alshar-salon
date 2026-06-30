"use client";

import { useState } from "react";
import { CalendarDays, X, Copy, Check } from "lucide-react";

export function CalendarSubscribe({ url }: { url: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const webcal = url.replace(/^https?:\/\//, "webcal://");

  function copy() {
    navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full border border-gold/40 px-4 py-2 text-sm text-gold hover:bg-gold/10">
        <CalendarDays size={15} /> Calendar
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setOpen(false)}>
          <div className="surface w-full max-w-md rounded-2xl border border-ink-line p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-xl text-cream">Bookings calendar</h3>
              <button onClick={() => setOpen(false)} className="text-muted hover:text-cream"><X size={18} /></button>
            </div>
            <p className="text-sm text-sand/85">Add this to <strong className="text-cream">Google Calendar</strong> (or Apple/Outlook) and every booking shows up automatically — viewable by anyone you share it with. It stays in sync; no app needed.</p>
            <ol className="mt-3 space-y-1 text-xs text-muted">
              <li>1. Google Calendar → <em>Other calendars</em> → <em>+</em> → <em>From URL</em></li>
              <li>2. Paste the link below → <em>Add calendar</em>.</li>
            </ol>
            <div className="mt-3 flex items-center gap-2">
              <input readOnly value={url} className="flex-1 truncate rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-xs text-cream" onFocus={(e) => e.currentTarget.select()} />
              <button onClick={copy} className="inline-flex items-center gap-1 rounded-lg border border-gold/40 px-3 py-2 text-xs text-gold hover:bg-gold/10">
                {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
              </button>
            </div>
            <a href={webcal} className="mt-3 inline-block text-xs text-gold hover:underline">Or open in your calendar app →</a>
            <p className="mt-3 text-[0.65rem] text-muted">Keep this link private — anyone with it can view the booking schedule.</p>
          </div>
        </div>
      )}
    </>
  );
}
