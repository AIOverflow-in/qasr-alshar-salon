"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2, Eye, EyeOff, Trash2 } from "lucide-react";
import { generatePostNow, togglePostStatus, deletePost } from "@/lib/actions/admin";

export function GenerateButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function go() {
    setMsg(null);
    start(async () => {
      const res = await generatePostNow();
      setMsg(res.ok ? `Published: ${res.title}` : res.error || "Failed");
      setTimeout(() => setMsg(null), 4000);
    });
  }

  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-xs text-gold">{msg}</span>}
      <button
        onClick={go}
        disabled={pending}
        className="flex items-center gap-2 rounded-full bg-gold-gradient px-5 py-2.5 text-sm font-semibold text-espresso disabled:opacity-60"
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        {pending ? "Generating…" : "Generate now"}
      </button>
    </div>
  );
}

export function PostActions({ id, published }: { id: string; published: boolean }) {
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <button
        title={published ? "Unpublish" : "Publish"}
        onClick={() => start(() => togglePostStatus(id))}
        disabled={pending}
        className="rounded-lg border border-ink-line p-2 text-sand hover:border-gold/50 hover:text-gold"
      >
        {published ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
      <button
        title="Delete"
        onClick={() => {
          if (confirm("Delete this post permanently?")) start(() => deletePost(id));
        }}
        disabled={pending}
        className="rounded-lg border border-ink-line p-2 text-sand hover:border-red-500/50 hover:text-red-400"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
