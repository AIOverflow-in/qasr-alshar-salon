"use client";

import { useState, useTransition } from "react";
import { Mail, Loader2 } from "lucide-react";
import { emailDailyDigestNow } from "@/lib/actions/finance";

/** Owner tool: send the daily takings digest email on demand (to the 3 notify addresses). */
export function SendDigestButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() =>
          start(async () => {
            setMsg(null);
            try {
              const r = await emailDailyDigestNow();
              setMsg(r.sent ? `Sent to ${r.recipients} ✓` : "Send failed — check email setup");
            } catch {
              setMsg("Couldn't send");
            }
          })
        }
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-ink-line px-3 py-2 text-sm text-sand hover:border-gold/50 hover:text-gold disabled:opacity-50"
        title="Email yesterday's takings digest to the salon addresses now"
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />} Email daily digest
      </button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </div>
  );
}
