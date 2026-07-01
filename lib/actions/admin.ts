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
import bcrypt from "bcryptjs";
import type { BookingStatus, Role } from "@prisma/client";

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
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function revalidateServices() {
  revalidatePath("/admin/services");
  revalidatePath("/erp/services");
  revalidatePath("/erp/bookings");
  revalidatePath("/erp/pos");
  revalidatePath("/services");
}

export async function updateService(
  id: string,
  data: { name?: string; category?: string; priceAED: number; durationMin: number; active: boolean }
) {
  await requireManager();
  const patch: { name?: string; category?: string; categorySlug?: string; priceAED: number; durationMin: number; active: boolean } = {
    priceAED: data.priceAED, durationMin: data.durationMin, active: data.active,
  };
  if (data.name !== undefined) {
    const name = data.name.trim();
    if (!name) throw new Error("Name is required.");
    patch.name = name;
  }
  if (data.category !== undefined) {
    const category = data.category.trim();
    if (!category) throw new Error("Category is required.");
    patch.category = category;
    patch.categorySlug = slugify(category); // keep the slug (URL) stable; only refresh categorySlug
  }
  await prisma.service.update({ where: { id }, data: patch });
  revalidateServices();
}

export async function createService(data: { name: string; category: string; priceAED: number; durationMin: number }) {
  await requireManager();
  const name = data.name.trim();
  const category = data.category.trim();
  if (!name || !category) throw new Error("Name and category are required.");
  // Unique slug: append -2, -3… on collision.
  const base = slugify(name);
  let slug = base;
  for (let i = 2; await prisma.service.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${base}-${i}`;
  const maxOrder = (await prisma.service.aggregate({ _max: { order: true } }))._max.order ?? 0;
  await prisma.service.create({
    data: { name, category, categorySlug: slugify(category), slug, priceAED: data.priceAED, durationMin: data.durationMin || 60, active: true, order: maxOrder + 1 },
  });
  revalidateServices();
}

// ---- staff + commissions ----
export async function updateStaff(
  id: string,
  data: {
    role?: string;
    hours?: string;
    offDay?: string | null;
    phone?: string | null;
    salaryAED?: number;
    commissionPct?: number;
    referralPct?: number;
    active?: boolean;
  }
) {
  await requireManager();
  const clean = {
    ...data,
    offDay: data.offDay?.trim() ? data.offDay.trim() : null,
    phone: data.phone?.trim() ? data.phone.trim() : null,
    salaryAED: data.salaryAED != null ? Math.max(0, Math.round(data.salaryAED)) : undefined,
    commissionPct: data.commissionPct != null ? Math.max(0, Math.min(100, Math.round(data.commissionPct))) : undefined,
    referralPct: data.referralPct != null ? Math.max(0, Math.min(100, Math.round(data.referralPct))) : undefined,
  };
  await prisma.staff.update({ where: { id }, data: clean });
  revalidatePath("/erp/staff");
}

// ---- payroll: adjustments + monthly pay ----
const MONTH_RE = /^\d{4}-\d{2}$/;

/** Add a manual bonus / advance / deduction for a staff member in a payroll month. */
export async function addPayAdjustment(
  staffId: string,
  month: string,
  type: "BONUS" | "ADVANCE" | "DEDUCTION",
  amountAED: number,
  note?: string | null
) {
  await requireManager();
  if (!MONTH_RE.test(month)) throw new Error("Invalid month");
  if (!["BONUS", "ADVANCE", "DEDUCTION"].includes(type)) throw new Error("Invalid type");
  const amt = Math.max(0, Math.round(amountAED));
  if (!amt) throw new Error("Amount must be greater than 0");
  await prisma.payAdjustment.create({ data: { staffId, month, type, amountAED: amt, note: note?.trim() || null } });
  revalidatePath("/erp/staff");
}

export async function deletePayAdjustment(id: string) {
  await requireManager();
  await prisma.payAdjustment.delete({ where: { id } });
  revalidatePath("/erp/staff");
}

/**
 * Pay a staff member for a Dubai month: snapshot the payslip (idempotent via the
 * staff+month unique key) and mark that month's unpaid commissions as paid.
 */
export async function payStaffMonth(staffId: string, month: string) {
  await requireManager();
  if (!MONTH_RE.test(month)) throw new Error("Invalid month");
  const { getPayrollMonth, dubaiMonthRange } = await import("@/lib/payroll");
  const payroll = await getPayrollMonth(month);
  const row = payroll.rows.find((r) => r.staffId === staffId);
  if (!row) throw new Error("Staff not found");
  const { start, end } = dubaiMonthRange(month);

  await prisma.$transaction([
    prisma.payrollPayment.upsert({
      where: { staffId_month: { staffId, month } },
      update: { salaryAED: row.salary, commissionAED: row.commission, bonusAED: row.bonus, deductionAED: row.deductions, netAED: row.net, paidAt: new Date() },
      create: { staffId, month, salaryAED: row.salary, commissionAED: row.commission, bonusAED: row.bonus, deductionAED: row.deductions, netAED: row.net },
    }),
    prisma.commission.updateMany({ where: { staffId, paid: false, createdAt: { gte: start, lt: end } }, data: { paid: true, paidAt: new Date() } }),
  ]);
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

// ---- ERP user accounts (owner-only) ----
async function requireSuperAdmin() {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") throw new Error("Forbidden");
  return session;
}

const VALID_ROLES = ["SUPER_ADMIN", "ADMIN", "RECEPTION", "STYLIST", "INVESTOR"];

export async function createUser(data: { name: string; email: string; role: Role; password: string }) {
  await requireSuperAdmin();
  const email = data.email.trim().toLowerCase();
  if (!email.includes("@")) return { ok: false, error: "Enter a valid email." };
  if (!data.password || data.password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };
  if (!VALID_ROLES.includes(data.role)) return { ok: false, error: "Invalid role." };
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) return { ok: false, error: "A user with that email already exists." };
  const passwordHash = await bcrypt.hash(data.password, 10);
  await prisma.adminUser.create({ data: { name: data.name.trim() || "Staff", email, role: data.role, passwordHash } });
  revalidatePath("/erp/users");
  return { ok: true };
}

export async function updateUserRole(id: string, role: Role) {
  await requireSuperAdmin();
  if (!VALID_ROLES.includes(role)) throw new Error("Invalid role");
  await prisma.adminUser.update({ where: { id }, data: { role } });
  revalidatePath("/erp/users");
}

export async function setUserActive(id: string, active: boolean) {
  const me = await requireSuperAdmin();
  if (id === me.sub && !active) throw new Error("You can't deactivate your own account.");
  await prisma.adminUser.update({ where: { id }, data: { active } });
  revalidatePath("/erp/users");
}

export async function setUserPassword(id: string, password: string) {
  await requireSuperAdmin();
  if (!password || password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };
  await prisma.adminUser.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  revalidatePath("/erp/users");
  return { ok: true };
}
