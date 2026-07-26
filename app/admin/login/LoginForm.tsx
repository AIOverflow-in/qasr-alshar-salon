"use client";

import { useActionState, useState } from "react";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { loginAction } from "@/lib/actions/admin";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);
  const [showPw, setShowPw] = useState(false);

  return (
    <form action={action} className="surface space-y-4 rounded-2xl p-6">
      <div>
        <label className="mb-1.5 block text-sm text-sand">Email</label>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-xl border border-ink-line bg-ink-card p-3 text-cream outline-none focus:border-gold/60"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm text-sand">Password</label>
        <div className="relative">
          <input
            name="password"
            type={showPw ? "text" : "password"}
            required
            autoComplete="current-password"
            className="w-full rounded-xl border border-ink-line bg-ink-card p-3 pr-12 text-cream outline-none focus:border-gold/60"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? "Hide password" : "Show password"}
            className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-muted hover:text-gold"
          >
            {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>
      {state?.error && (
        <p role="alert" className="rounded-lg border border-red-500/40 bg-red-50 p-2.5 text-sm text-red-600">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-gold-gradient py-3 font-semibold text-espresso disabled:opacity-60"
      >
        {pending && <Loader2 className="animate-spin" size={16} />}
        Sign In
      </button>
    </form>
  );
}
