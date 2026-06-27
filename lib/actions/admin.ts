"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  getSession,
  createSession,
  destroySession,
  verifyCredentials,
} from "@/lib/auth";
import { generateBlogPost } from "@/lib/openai";
import { sendAftercareEmail } from "@/lib/email";
import type { BookingStatus } from "@prisma/client";

/** Front-desk operations: bookings/POS-adjacent. Excludes read-only INVESTOR and STYLIST. */
async function requireReception() {
  const session = await getSession();
  if (!session || !["SUPER_ADMIN", "ADMIN", "RECEPTION"].includes(session.role)) {
    throw new Error("Forbidden");
  }
  return session;
}

/** Management-only: services, hours, settings, staff, blog. SUPER_ADMIN / ADMIN. */
async function requireManager() {
  const session = await getSession();
  if (!session || (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN")) {
    throw new Error("Forbidden");
  }
  return session;
}

// ---- auth ----
export async function loginAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const user = await verifyCredentials(email, password);
  if (!user) return { error: "Invalid email or password." };
  await createSession({ id: user.id, email: user.email, role: user.role });
  // Everyone lands in the full ERP — it adapts to the role (POS, finance, etc.).
  redirect("/erp");
}

export async function logoutAction() {
  await destroySession();
  redirect("/admin/login");
}

// ---- bookings ----
export async function setBookingStatus(id: string, status: BookingStatus) {
  await requireReception();
  const booking = await prisma.booking.update({ where: { id }, data: { status } });

  // On completion, send an aftercare recommendation email (best-effort).
  if (status === "COMPLETED" && booking.email) {
    try {
      const products = await prisma.product.findMany({
        where: { active: true, category: { contains: "Retail", mode: "insensitive" }, qty: { gt: 0 } },
        orderBy: { updatedAt: "desc" },
        take: 4,
        select: { name: true },
      });
      await sendAftercareEmail({
        customerName: booking.customerName,
        email: booking.email,
        serviceName: booking.serviceName,
        products: products.map((p) => p.name),
      });
    } catch (e) {
      console.error("[aftercare] send failed (non-fatal):", e);
    }
  }

  revalidatePath("/admin/bookings");
  revalidatePath("/erp/bookings");
  revalidatePath("/erp");
}

// ---- services ----
export async function updateService(
  id: string,
  data: { priceAED: number; durationMin: number; active: boolean }
) {
  await requireManager();
  await prisma.service.update({ where: { id }, data });
  revalidatePath("/admin/services");
}

// ---- staff + commissions ----
export async function updateStaff(
  id: string,
  data: {
    role?: string;
    hours?: string;
    offDay?: string | null;
    commissionPct?: number;
    referralPct?: number;
    active?: boolean;
  }
) {
  await requireManager();
  const clean = {
    ...data,
    offDay: data.offDay?.trim() ? data.offDay.trim() : null,
    commissionPct: data.commissionPct != null ? Math.max(0, Math.min(100, Math.round(data.commissionPct))) : undefined,
    referralPct: data.referralPct != null ? Math.max(0, Math.min(100, Math.round(data.referralPct))) : undefined,
  };
  await prisma.staff.update({ where: { id }, data: clean });
  revalidatePath("/erp/staff");
}

/** Mark every unpaid commission for a staff member as paid (payroll settle). */
export async function settleCommissions(staffId: string) {
  await requireManager();
  await prisma.commission.updateMany({
    where: { staffId, paid: false },
    data: { paid: true, paidAt: new Date() },
  });
  revalidatePath("/erp/staff");
}

// ---- working hours + settings ----
export async function updateWorkingHours(
  weekday: number,
  data: { open: string; close: string; closed: boolean }
) {
  await requireManager();
  await prisma.workingHours.update({ where: { weekday }, data });
  revalidatePath("/admin/hours");
}

export async function updateSettings(data: {
  capacity: number;
  slotMinutes: number;
  leadTimeMinutes: number;
  maxAdvanceDays: number;
}) {
  await requireManager();
  await prisma.salonSettings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });
  revalidatePath("/admin/hours");
}

export async function addBlockedSlot(startISO: string, endISO: string, reason: string) {
  await requireManager();
  await prisma.blockedSlot.create({
    data: { startAt: new Date(startISO), endAt: new Date(endISO), reason: reason || null },
  });
  revalidatePath("/admin/hours");
}

export async function removeBlockedSlot(id: string) {
  await requireManager();
  await prisma.blockedSlot.delete({ where: { id } });
  revalidatePath("/admin/hours");
}

// ---- blog ----
export async function generatePostNow() {
  await requireManager();
  const post = await generateBlogPost();
  if (post) {
    revalidatePath("/admin/blog");
    revalidatePath("/erp/blog");
    revalidatePath("/blog");
    revalidatePath(`/blog/${post.slug}`);
    return { ok: true, title: post.title };
  }
  return { ok: false, error: "Generation failed. Check the OpenAI key." };
}

export async function togglePostStatus(id: string) {
  await requireManager();
  const post = await prisma.blogPost.findUnique({ where: { id } });
  if (!post) return;
  await prisma.blogPost.update({
    where: { id },
    data: { status: post.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" },
  });
  revalidatePath("/admin/blog");
  revalidatePath("/erp/blog");
  revalidatePath("/blog");
}

export async function deletePost(id: string) {
  await requireManager();
  await prisma.blogPost.delete({ where: { id } });
  revalidatePath("/admin/blog");
  revalidatePath("/erp/blog");
  revalidatePath("/blog");
}
