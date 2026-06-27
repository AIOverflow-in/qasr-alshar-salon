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
import type { BookingStatus } from "@prisma/client";

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

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
  redirect(user.role === "RECEPTION" || user.role === "STYLIST" ? "/erp" : "/admin");
}

export async function logoutAction() {
  await destroySession();
  redirect("/admin/login");
}

// ---- bookings ----
export async function setBookingStatus(id: string, status: BookingStatus) {
  await requireAdmin();
  await prisma.booking.update({ where: { id }, data: { status } });
  revalidatePath("/admin");
  revalidatePath("/admin/bookings");
}

// ---- services ----
export async function updateService(
  id: string,
  data: { priceAED: number; durationMin: number; active: boolean }
) {
  await requireAdmin();
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
  await requireAdmin();
  await prisma.workingHours.update({ where: { weekday }, data });
  revalidatePath("/admin/hours");
}

export async function updateSettings(data: {
  capacity: number;
  slotMinutes: number;
  leadTimeMinutes: number;
  maxAdvanceDays: number;
}) {
  await requireAdmin();
  await prisma.salonSettings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });
  revalidatePath("/admin/hours");
}

export async function addBlockedSlot(startISO: string, endISO: string, reason: string) {
  await requireAdmin();
  await prisma.blockedSlot.create({
    data: { startAt: new Date(startISO), endAt: new Date(endISO), reason: reason || null },
  });
  revalidatePath("/admin/hours");
}

export async function removeBlockedSlot(id: string) {
  await requireAdmin();
  await prisma.blockedSlot.delete({ where: { id } });
  revalidatePath("/admin/hours");
}

// ---- blog ----
export async function generatePostNow() {
  await requireAdmin();
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
  await requireAdmin();
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
  await requireAdmin();
  await prisma.blogPost.delete({ where: { id } });
  revalidatePath("/admin/blog");
  revalidatePath("/erp/blog");
  revalidatePath("/blog");
}
