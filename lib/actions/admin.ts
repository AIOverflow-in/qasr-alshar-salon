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
import { inclusiveDays } from "@/lib/leave";
import { normalizeNewStaff } from "@/lib/staff-core";
import { stylistNeedsStaff, UNLINKED_STYLIST_ERROR } from "@/lib/user-core";
import { userDeletionGuard } from "@/lib/erp-users-core";
import { del } from "@vercel/blob";
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
/** Onboard a new staff member (payroll/commission entity, not a login account). Managers only. */
export async function createStaff(input: {
  name: string;
  role?: string;
  phone?: string | null;
  salaryAED?: number;
  commissionPct?: number;
  referralPct?: number;
  joinedOn?: string | null;
}) {
  await requireManager();
  let clean;
  try {
    clean = normalizeNewStaff(input);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid input." };
  }
  const maxOrder = (await prisma.staff.aggregate({ _max: { order: true } }))._max.order ?? 0;
  await prisma.staff.create({ data: { ...clean, order: maxOrder + 1 } });
  revalidatePath("/erp/staff");
  return { ok: true };
}

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
    joinedOn?: string | null;
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
    joinedOn: data.joinedOn !== undefined ? (data.joinedOn ? new Date(data.joinedOn) : null) : undefined,
  };
  await prisma.staff.update({ where: { id }, data: clean });
  revalidatePath("/erp/staff");
}

// ---- staff documents (owner/SUPER_ADMIN only) & leave (managers) ----
// Persist a staff document AFTER the file was uploaded directly to Blob (client
// upload → /api/erp/blob-upload). Owner-only.
export async function addStaffDocument(staffId: string, data: { type: string; expiry?: string | null; fileUrl: string; pathname: string }) {
  await requireSuperAdmin();
  if (!data.fileUrl) return { ok: false, error: "Upload a file first." };
  const type = ["PASSPORT", "VISA", "LABOR_CARD", "EMIRATES_ID", "OTHER"].includes(data.type) ? data.type : "OTHER";
  if (!(await prisma.staff.findUnique({ where: { id: staffId }, select: { id: true } }))) return { ok: false, error: "Staff not found." };
  const expiry = data.expiry && /^\d{4}-\d{2}-\d{2}$/.test(data.expiry) ? new Date(data.expiry) : null;
  await prisma.staffDocument.create({ data: { staffId, type, fileUrl: data.fileUrl, pathname: data.pathname, expiry } });
  revalidatePath(`/erp/staff/${staffId}`);
  return { ok: true };
}

export async function deleteStaffDocument(id: string) {
  await requireSuperAdmin();
  const doc = await prisma.staffDocument.findUnique({ where: { id }, select: { pathname: true, staffId: true } });
  if (doc?.pathname) { try { await del(doc.pathname); } catch (e) { console.error("[blob] del failed:", e); } }
  await prisma.staffDocument.delete({ where: { id } });
  if (doc) revalidatePath(`/erp/staff/${doc.staffId}`);
}

// Persist a company-vault document AFTER the file was uploaded directly to Blob. Owner-only.
export async function createCompanyDocument(data: { title: string; description?: string | null; category: string; fileUrl: string; pathname: string; fileName?: string | null; sizeBytes?: number | null }) {
  const session = await requireSuperAdmin();
  const title = data.title.trim();
  if (!title) return { ok: false, error: "Add a title." };
  if (!data.fileUrl) return { ok: false, error: "Upload a file first." };
  const category = ["TAX", "LICENSE", "LEASE", "INSURANCE", "FINANCE", "HR", "OTHER"].includes(data.category) ? data.category : "OTHER";
  await prisma.companyDocument.create({
    data: {
      title, description: data.description?.trim() || null, category: category as never,
      fileUrl: data.fileUrl, pathname: data.pathname, fileName: (data.fileName || "").slice(0, 200) || null,
      sizeBytes: data.sizeBytes ?? null, uploadedById: session.sub,
    },
  });
  revalidatePath("/erp/documents");
  return { ok: true };
}

export async function addStaffLeave(
  staffId: string,
  data: { startDate: string; endDate: string; type?: string; note?: string | null }
) {
  await requireManager();
  const start = new Date(data.startDate), end = new Date(data.endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new Error("Invalid dates");
  if (end < start) throw new Error("End date is before the start date");
  const type = ["ANNUAL", "SICK", "UNPAID"].includes(data.type ?? "") ? data.type! : "ANNUAL";
  await prisma.staffLeave.create({
    data: { staffId, startDate: start, endDate: end, days: inclusiveDays(start, end), type, note: data.note?.trim() || null },
  });
  revalidatePath(`/erp/staff/${staffId}`);
}

export async function deleteStaffLeave(id: string) {
  await requireManager();
  const l = await prisma.staffLeave.findUnique({ where: { id }, select: { staffId: true } });
  await prisma.staffLeave.delete({ where: { id } });
  if (l) revalidatePath(`/erp/staff/${l.staffId}`);
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

  // Email the payslip to the staff member (11 Aug meeting: "once we click pay they should receive
  // a payslip"). Staff has no email of its own, so this uses their linked ERP login. Entirely
  // best-effort — a mail failure must never undo a payment that has already been recorded.
  try {
    const login = await prisma.adminUser.findFirst({ where: { staffId, active: true }, select: { email: true } });
    if (login?.email) {
      const [{ buildPayslipPdf }, { sendPayslipEmail }] = await Promise.all([
        import("@/lib/payslip-pdf"),
        import("@/lib/email"),
      ]);
      const [y, m] = month.split("-").map(Number);
      const monthLabel = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
      const pdf = await buildPayslipPdf({
        staffName: row.name, role: row.role, month, clientsServed: row.clientsServed,
        grossAED: row.grossAED, netSaleAED: row.servicesAED, salary: row.salary,
        salesCommission: row.salesCommission, referral: row.referral, bonus: row.bonus,
        deductions: row.deductions, net: row.net, paidAt: new Date().toISOString(),
      });
      await sendPayslipEmail({ staffName: row.name, email: login.email, monthLabel, netAED: row.net, pdf });
    }
  } catch (e) {
    console.error("[payroll] payslip email failed (payment still recorded):", e);
  }

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
  depositAED: number;
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

export async function updatePost(id: string, data: {
  title: string; category: string; status: "DRAFT" | "PUBLISHED";
  excerpt: string; metaDescription: string; targetKeyword: string;
  tags: string[]; contentMarkdown: string;
}) {
  await requireManager();
  const post = await prisma.blogPost.findUnique({ where: { id }, select: { slug: true } });
  if (!post) return { ok: false as const, error: "Post not found" };
  await prisma.blogPost.update({
    where: { id },
    data: {
      title: data.title.trim(),
      category: data.category.trim() || "Beauty Tips",
      status: data.status,
      excerpt: data.excerpt.trim(),
      metaDescription: data.metaDescription.trim(),
      targetKeyword: data.targetKeyword.trim() || null,
      tags: data.tags.map((t) => t.trim().toLowerCase()).filter(Boolean),
      contentMarkdown: data.contentMarkdown,
      // publishedAt is intentionally NOT touched — editing must never move the publish date.
    },
  });
  revalidatePath("/erp/blog");
  revalidatePath("/blog");
  revalidatePath(`/blog/${post.slug}`);
  return { ok: true as const };
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

export async function createUser(data: { name: string; email: string; role: Role; password: string; staffId?: string | null }) {
  await requireSuperAdmin();
  const email = data.email.trim().toLowerCase();
  if (!email.includes("@")) return { ok: false, error: "Enter a valid email." };
  if (!data.password || data.password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };
  if (!VALID_ROLES.includes(data.role)) return { ok: false, error: "Invalid role." };
  // A crown artist login MUST be linked to a staff record, or their calendar is empty.
  const staffId = data.role === "STYLIST" ? (data.staffId || null) : null;
  if (stylistNeedsStaff(data.role, staffId)) return { ok: false, error: UNLINKED_STYLIST_ERROR };
  if (staffId && !(await prisma.staff.findUnique({ where: { id: staffId }, select: { id: true } }))) {
    return { ok: false, error: "Selected staff record not found." };
  }
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) return { ok: false, error: "A user with that email already exists." };
  const passwordHash = await bcrypt.hash(data.password, 10);
  await prisma.adminUser.create({ data: { name: data.name.trim() || "Staff", email, role: data.role, passwordHash, staffId } });
  revalidatePath("/erp/users");
  return { ok: true };
}

export async function updateUserRole(id: string, role: Role) {
  const me = await requireSuperAdmin();
  // Can't demote yourself — otherwise the last Super Admin could lock everyone out of user management.
  if (id === me.sub) return { ok: false, error: "You can't change your own role — ask another Super Admin." };
  if (!VALID_ROLES.includes(role)) return { ok: false, error: "Invalid role." };
  // Block switching to crown artist unless the login is already linked to a staff record.
  if (role === "STYLIST") {
    const u = await prisma.adminUser.findUnique({ where: { id }, select: { staffId: true } });
    if (stylistNeedsStaff(role, u?.staffId)) {
      return { ok: false, error: "Link this login to a staff record first (set “Staff”), then switch to Crown Artist." };
    }
  }
  await prisma.adminUser.update({ where: { id }, data: { role } });
  revalidatePath("/erp/users");
  return { ok: true };
}

/** Link (or, for non-stylists, unlink) a login to a Staff record. A STYLIST can't be unlinked. */
export async function setUserStaff(id: string, staffId: string | null) {
  await requireSuperAdmin();
  const user = await prisma.adminUser.findUnique({ where: { id }, select: { role: true } });
  if (!user) return { ok: false, error: "User not found." };
  if (staffId) {
    if (!(await prisma.staff.findUnique({ where: { id: staffId }, select: { id: true } }))) {
      return { ok: false, error: "That staff record no longer exists." };
    }
  } else if (user.role === "STYLIST") {
    return { ok: false, error: "A crown-artist login must stay linked to a staff record." };
  }
  await prisma.adminUser.update({ where: { id }, data: { staffId } });
  revalidatePath("/erp/users");
  return { ok: true };
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

/**
 * Permanently delete a login account. Safeguarded (see userDeletionGuard): can't
 * delete yourself, the last Super Admin, or a login tied to bills (deactivate
 * those instead). The linked Staff record — and all its history — is untouched.
 */
export async function deleteUser(id: string) {
  const me = await requireSuperAdmin();
  const user = await prisma.adminUser.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!user) return { ok: false, error: "User not found." };
  const [supers, createdOrders] = await Promise.all([
    user.role === "SUPER_ADMIN" ? prisma.adminUser.count({ where: { role: "SUPER_ADMIN" } }) : Promise.resolve(2),
    prisma.salesOrder.count({ where: { createdById: id } }),
  ]);
  const guard = userDeletionGuard({
    isSelf: id === me.sub,
    isLastSuperAdmin: user.role === "SUPER_ADMIN" && supers <= 1,
    createdOrders,
  });
  if (!guard.ok) return guard;
  try {
    await prisma.adminUser.delete({ where: { id } });
  } catch {
    // Any other DB link (e.g. uploaded documents) — keep the login, guide to deactivate.
    return { ok: false, error: "This login is linked to other records — deactivate it instead." };
  }
  revalidatePath("/erp/users");
  return { ok: true };
}

/** Map a biometric-terminal user ID (PIN) to a staff member; backfills that PIN's existing punches. */
export async function setStaffBiometricPin(staffId: string, pin: string) {
  await requireManager();
  const clean = pin.trim();
  await prisma.$transaction(async (tx) => {
    // A PIN belongs to one staff — free it from anyone else first (biometricPin is unique).
    if (clean) await tx.staff.updateMany({ where: { biometricPin: clean, NOT: { id: staffId } }, data: { biometricPin: null } });
    await tx.staff.update({ where: { id: staffId }, data: { biometricPin: clean || null } });
    // Attach already-received punches for this PIN to the staff (or detach if cleared).
    if (clean) await tx.attendancePunch.updateMany({ where: { pin: clean, staffId: null }, data: { staffId } });
  });
  revalidatePath("/erp/attendance");
  revalidatePath(`/erp/staff/${staffId}`);
}

// ── Staff loans (11 Aug meeting: "who is owing what", deducted monthly) ──────

/** Record a loan / advance given to a staff member. */
export async function addStaffLoan(staffId: string, amountAED: number, note?: string | null) {
  await requireManager();
  const amt = Math.max(0, Math.round(amountAED));
  if (!amt) throw new Error("Amount must be greater than 0");
  await prisma.staffLoan.create({ data: { staffId, amountAED: amt, note: note?.trim() || null } });
  revalidatePath("/erp/staff");
}

/** Remove a loan entirely (mistaken entry). Repayments already deducted are not reversed. */
export async function deleteStaffLoan(id: string) {
  await requireManager();
  await prisma.staffLoan.delete({ where: { id } });
  revalidatePath("/erp/staff");
}

/**
 * Take a repayment out of a month's pay: creates the DEDUCTION adjustment AND credits the loan in
 * ONE transaction, so the balance and the payslip can never disagree. Closes the loan when cleared.
 */
export async function repayStaffLoan(loanId: string, month: string, amountAED: number) {
  await requireManager();
  if (!MONTH_RE.test(month)) throw new Error("Invalid month");
  const loan = await prisma.staffLoan.findUnique({ where: { id: loanId } });
  if (!loan) throw new Error("Loan not found");

  const outstanding = Math.max(0, loan.amountAED - loan.repaidAED);
  const amt = Math.min(Math.max(0, Math.round(amountAED)), outstanding);
  if (!amt) throw new Error("Nothing left to repay");

  const repaid = loan.repaidAED + amt;
  await prisma.$transaction([
    prisma.payAdjustment.create({
      data: { staffId: loan.staffId, month, type: "DEDUCTION", amountAED: amt, note: `Loan repayment${loan.note ? ` — ${loan.note}` : ""}` },
    }),
    prisma.staffLoan.update({
      where: { id: loanId },
      data: { repaidAED: repaid, closedAt: repaid >= loan.amountAED ? new Date() : null },
    }),
  ]);
  revalidatePath("/erp/staff");
}

/**
 * Apply the unpaid-leave deduction for a month as an ordinary DEDUCTION, so it's visible and
 * removable like any other adjustment rather than silently altering the pay formula.
 */
export async function applyUnpaidLeaveDeduction(staffId: string, month: string, amountAED: number, days: number) {
  await requireManager();
  if (!MONTH_RE.test(month)) throw new Error("Invalid month");
  const amt = Math.max(0, Math.round(amountAED));
  if (!amt) throw new Error("Nothing to deduct");
  await prisma.payAdjustment.create({
    data: { staffId, month, type: "DEDUCTION", amountAED: amt, note: `Unpaid leave — ${days} day${days === 1 ? "" : "s"}` },
  });
  revalidatePath("/erp/staff");
}

/**
 * Set the same sale price on several products at once (11 Aug meeting: storefront bulk operations).
 * Managers only. Returns how many rows actually changed so the UI can report it honestly.
 */
export async function bulkSetProductPrice(ids: string[], saleAED: number) {
  await requireManager();
  const price = Math.max(0, Math.round(saleAED));
  if (!price) throw new Error("Enter a price greater than 0");
  const clean = [...new Set(ids)].filter(Boolean);
  if (!clean.length) throw new Error("Select at least one product");
  if (clean.length > 200) throw new Error("Too many products at once — narrow the selection");

  const res = await prisma.product.updateMany({ where: { id: { in: clean } }, data: { saleAED: price } });
  // The storefront caches product reads; without this the new prices appear only after 5 minutes.
  const { revalidateShopEverywhere } = await import("@/lib/revalidate-shop");
  await revalidateShopEverywhere();
  revalidatePath("/erp/products");
  return { updated: res.count };
}
