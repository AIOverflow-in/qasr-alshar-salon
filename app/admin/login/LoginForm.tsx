"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { loginAction } from "@/lib/actions/admin";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);

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
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-xl border border-ink-line bg-ink-card p-3 text-cream outline-none focus:border-gold/60"
        />
      </div>
      {state?.error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-2.5 text-sm text-red-300">
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
