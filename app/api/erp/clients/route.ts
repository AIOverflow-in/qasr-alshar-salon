import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

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

  const client = await prisma.client.create({ data: parsed.data });
  return NextResponse.json({ ok: true, client });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { id, ...data } = parsed.data;
  const client = await prisma.client.update({ where: { id }, data });
  return NextResponse.json({ ok: true, client });
}
