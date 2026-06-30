"use client";

import { useState, useTransition } from "react";
import { UserPlus, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { createUser, updateUserRole, setUserActive, setUserPassword } from "@/lib/actions/admin";
import type { Role } from "@prisma/client";

type User = { id: string; name: string; email: string; role: Role; active: boolean };
const ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "RECEPTION", "STYLIST", "INVESTOR"];
const ROLE_LABEL: Record<Role, string> = { SUPER_ADMIN: "Super Admin", ADMIN: "Manager", RECEPTION: "Reception", STYLIST: "Crown Artist", INVESTOR: "Investor" };

export function UsersManager({ users, currentUserId }: { users: User[]; currentUserId: string }) {
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [nu, setNu] = useState({ name: "", email: "", role: "RECEPTION" as Role, password: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const input = "rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-sm text-cream outline-none focus:border-gold/60";

  function add() {
    setErr(null);
    start(async () => {
      const res = await createUser(nu);
      if (!res?.ok) { setErr(res?.error ?? "Could not create user."); return; }
      setNu({ name: "", email: "", role: "RECEPTION", password: "" });
      setAdding(false);
    });
  }
  function act(id: string, fn: () => Promise<unknown>) { setBusyId(id); start(async () => { await fn(); setBusyId(null); }); }
  function resetPw(id: string, name: string) {
    const pw = window.prompt(`New password for ${name} (min 6 chars):`);
    if (!pw) return;
    act(id, async () => { const r = await setUserPassword(id, pw); if (r && !r.ok) alert(r.error); });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setAdding((v) => !v)} className="inline-flex items-center gap-2 rounded-full bg-gold-gradient px-4 py-2 text-sm font-semibold text-espresso">
          <UserPlus size={15} /> {adding ? "Cancel" : "Add user"}
        </button>
      </div>

      {adding && (
        <div className="surface rounded-2xl p-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <input className={input} placeholder="Full name" value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} />
            <input className={input} placeholder="Email" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} />
            <select className={input} value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value as Role })}>
              {ROLES.map((r) => <option key={r} value={r} className="bg-ink">{ROLE_LABEL[r]}</option>)}
            </select>
            <input className={input} type="text" placeholder="Temp password (≥6)" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} />
          </div>
          {err && <p className="mt-2 text-sm text-red-400">{err}</p>}
          <button onClick={add} disabled={pending} className="mt-3 rounded-lg bg-gold-gradient px-4 py-2 text-sm font-semibold text-espresso disabled:opacity-50">
            {pending ? "Creating…" : "Create user"}
          </button>
        </div>
      )}

      <div className="surface overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-ink-line text-left text-muted">
            <tr>
              <th className="p-4 font-medium">Name</th>
              <th className="p-4 font-medium">Email</th>
              <th className="p-4 font-medium">Role</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-line/60">
            {users.map((u) => (
              <tr key={u.id} className={cn(busyId === u.id && "opacity-50")}>
                <td className="p-4 text-cream">{u.name}{u.id === currentUserId && <span className="ml-2 text-[0.6rem] text-gold">you</span>}</td>
                <td className="p-4 text-muted">{u.email}</td>
                <td className="p-4">
                  <select
                    defaultValue={u.role}
                    onChange={(e) => act(u.id, () => updateUserRole(u.id, e.target.value as Role))}
                    className="rounded-lg border border-ink-line bg-ink-card px-2 py-1.5 text-xs text-cream outline-none focus:border-gold/60"
                  >
                    {ROLES.map((r) => <option key={r} value={r} className="bg-ink">{ROLE_LABEL[r]}</option>)}
                  </select>
                </td>
                <td className="p-4">
                  <button
                    onClick={() => act(u.id, () => setUserActive(u.id, !u.active))}
                    disabled={u.id === currentUserId && u.active}
                    className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50", u.active ? "border-green-500/40 text-green-400" : "border-muted/40 text-muted")}
                    title={u.id === currentUserId ? "You can't deactivate yourself" : "Toggle active"}
                  >
                    {u.active ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="p-4 text-right">
                  <button onClick={() => resetPw(u.id, u.name)} className="inline-flex items-center gap-1 rounded-lg border border-ink-line px-2.5 py-1.5 text-xs text-sand hover:border-gold/50 hover:text-gold">
                    <KeyRound size={12} /> Reset password
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Deactivating a user blocks their login immediately for new sessions. Roles: Reception can take bookings + bills; Manager adds staff/finance; Super Admin manages users.</p>
    </div>
  );
}
