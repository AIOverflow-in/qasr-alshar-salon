import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { phoneSig } from "@/lib/clients";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email().optional().nullable(),
  hairType: z.string().max(80).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  consentMarketing: z.boolean().optional(),
});

const updateSchema = createSchema.partial().extend({ id: z.string().min(1) });

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = ["SUPER_ADMIN", "ADMIN", "RECEPTION"];
  if (!allowed.includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const d = parsed.data;
  const email = (d.email ?? "").trim().toLowerCase() || null;

  // Dedupe: if this phone/email already exists, return that client instead of
  // creating a duplicate (reception re-adding a known walk-in).
  const sig = phoneSig(d.phone);
  const or: object[] = [];
  if (sig) or.push({ phone: { contains: sig } });
  if (email) or.push({ email });
  const existing = or.length ? await prisma.client.findFirst({ where: { OR: or } }) : null;
  if (existing) return NextResponse.json({ ok: true, client: existing, existing: true });

  const client = await prisma.client.create({ data: { ...d, email } });
  return NextResponse.json({ ok: true, client });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = ["SUPER_ADMIN", "ADMIN", "RECEPTION"];
  if (!allowed.includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { id, ...data } = parsed.data;
  const client = await prisma.client.update({ where: { id }, data });
  return NextResponse.json({ ok: true, client });
}
