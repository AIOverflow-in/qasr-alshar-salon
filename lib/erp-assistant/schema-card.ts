/**
 * The assistant's view of the database — ONE source of truth for both the prompt text the model
 * sees and the allowlists the SQL guard enforces, so the two can never drift apart.
 *
 * SECURITY: a table or column that isn't listed here does not exist as far as the assistant is
 * concerned. Secrets (password hashes, passport / Emirates-ID / labour-card numbers, biometric
 * pins, document file URLs) are deliberately absent, and the document tables are excluded whole.
 *
 * Pure — no Prisma, no env, no server-only — so the guard stays unit-testable and importable
 * from scripts/e2e.mjs. Growth is handled by schema-card.drift.test.ts, which fails the suite if
 * a new model or column is neither exposed nor consciously excluded.
 */

export type ColKind = "int" | "aed" | "str" | "date" | "bool" | "enum" | "arr";
export type ColSpec = { n: string; t: ColKind; v?: string };
export type TableSpec = { table: string; note: string; cols: ColSpec[]; omit?: string[] };

const T = (table: string, note: string, cols: ColSpec[], omit?: string[]): TableSpec => ({ table, note, cols, omit });
const c = (n: string, t: ColKind = "str", v?: string): ColSpec => ({ n, t, v });

/** Business tables the assistant may query. Order = order in the prompt. */
export const SCHEMA_TABLES: readonly TableSpec[] = [
  T("SalesOrder", "POS bill / invoice. Revenue counts ONLY status='PAID', by createdAt.", [
    c("id"), c("invoiceNo"), c("status", "enum", "DRAFT|PAID|VOIDED"), c("paymentMethod", "enum", "CASH|CARD|TRANSFER"),
    c("splitPayment", "bool"), c("cashAED", "aed"), c("cardAED", "aed"), c("transferAED", "aed"),
    c("bookingId"), c("clientId"), c("staffId"), c("marketerId"), c("marketerPct", "int"),
    c("subtotalAED", "aed"), c("vatPct", "int"), c("vatAED", "aed"), c("totalAED", "aed"),
    c("notes"), c("paidAt", "date"), c("createdAt", "date"),
  ], ["clientRequestId", "createdById", "updatedAt"]),

  T("OrderLine", "Line items on a bill. staffIds is text[] of the artists who did that line.", [
    c("id"), c("orderId"), c("kind", "enum", "SERVICE|PRODUCT"), c("description"),
    c("qty", "int"), c("unitAED", "aed"), c("lineAED", "aed"), c("staffId"), c("staffIds", "arr"), c("productId"),
  ]),

  T("Booking", "Appointment. Money lives on SalesOrder, not here.", [
    c("id"), c("serviceId"), c("serviceName"), c("priceAED", "aed"), c("durationMin", "int"),
    c("customerName"), c("startAt", "date"), c("endAt", "date"),
    c("status", "enum", "CONFIRMED|COMPLETED|CANCELLED|NO_SHOW"),
    c("staffId"), c("marketerId"), c("clientId"), c("source"), c("serviceMode"),
    c("depositAED", "aed"), c("depositPaidAt", "date"), c("createdAt", "date"),
  ], ["email", "phone", "notes", "address", "customRequest", "locale", "createdById", "feedbackSentAt", "rebookSentAt", "updatedAt"]),

  T("BookingItem", "Services on a multi-service booking.", [
    c("id"), c("bookingId"), c("serviceId"), c("serviceName"), c("priceAED", "aed"), c("durationMin", "int"), c("staffId"), c("createdAt", "date"),
  ]),

  T("Client", "CRM record. visits and totalSpentAED are running totals.", [
    c("id"), c("name"), c("phone"), c("email"), c("hairType"),
    c("visits", "int"), c("totalSpentAED", "aed"), c("consentMarketing", "bool"), c("createdAt", "date"),
  ], ["notes", "updatedAt"]),

  T("Staff", "Team member (a 'Crown Artist'). salaryAED is the monthly base floor.", [
    c("id"), c("name"), c("role"), c("hours"), c("offDay"),
    c("salaryAED", "aed"), c("commissionPct", "int"), c("referralPct", "int"),
    c("joinedOn", "date"), c("active", "bool"), c("order", "int"),
  ], ["phone", "biometricPin", "passportNumber", "passportExpiry", "emiratesId", "emiratesIdExpiry",
      "labourPermitNumber", "labourCardNumber", "emergencyContact", "emergencyRelationship",
      "passportPicLink", "createdAt", "updatedAt"]),

  T("Service", "Menu item. priceAED is VAT-INCLUSIVE (gross).", [
    c("id"), c("name"), c("category"), c("priceAED", "aed"), c("durationMin", "int"), c("active", "bool"), c("order", "int"),
  ], ["slug", "categorySlug", "description", "createdAt", "updatedAt"]),

  T("Product", "Stock item. Low stock = qty <= reorderAt.", [
    c("id"), c("barcode"), c("name"), c("category"), c("qty", "int"), c("reorderAt", "int"),
    c("costAED", "aed"), c("saleAED", "aed"), c("retail", "bool"), c("active", "bool"),
  ], ["description", "imageUrl", "slug", "createdAt", "updatedAt"]),

  T("StockMovement", "Stock in/out history.", [
    c("id"), c("productId"), c("kind", "enum", "STOCK_IN|STOCK_OUT|SALE|ADJUSTMENT"),
    c("qty", "int"), c("note"), c("staffId"), c("createdAt", "date"),
  ]),

  T("Commission", "What an artist earned on a bill. type is SALES_SPLIT | REFERRAL | INCENTIVE.", [
    c("id"), c("staffId"), c("orderId"), c("type"), c("baseAED", "aed"), c("pct", "int"),
    c("amountAED", "aed"), c("paid", "bool"), c("paidAt", "date"), c("createdAt", "date"),
  ]),

  T("PayAdjustment", "Monthly bonus / advance / deduction. month is 'YYYY-MM'.", [
    c("id"), c("staffId"), c("month"), c("type", "enum", "BONUS|ADVANCE|DEDUCTION"),
    c("amountAED", "aed"), c("note"), c("createdAt", "date"),
  ]),

  T("PayrollPayment", "A salary actually paid out for a month. month is 'YYYY-MM'.", [
    c("id"), c("staffId"), c("month"), c("salaryAED", "aed"), c("commissionAED", "aed"),
    c("bonusAED", "aed"), c("deductionAED", "aed"), c("netAED", "aed"), c("paidAt", "date"),
  ]),

  T("Expense", "Operating expense, counted by incurredOn (NOT createdAt).", [
    c("id"), c("category", "enum", "RENT|UTILITIES|SALARIES|VISA|SUPPLIES|MARKETING|MAINTENANCE|FOOD|PARKING|CEO_ALLOWANCE|OTHER"),
    c("description"), c("amountAED", "aed"), c("incurredOn", "date"), c("recurring", "bool"),
    c("notes"), c("invoiceNo"),
  ], ["receiptUrl", "receiptPath", "receiptUrls", "receiptPaths", "createdById", "createdAt", "updatedAt"]),

  T("ScheduledPayment", "Upcoming bill (rent, cheques). Creates an Expense when marked paid.", [
    c("id"), c("label"), c("category", "enum", "RENT|UTILITIES|SALARIES|VISA|SUPPLIES|MARKETING|MAINTENANCE|FOOD|PARKING|CEO_ALLOWANCE|OTHER"),
    c("amountAED", "aed"), c("dueDate", "date"), c("payee"), c("method"),
    c("status", "enum", "PENDING|PAID"), c("paidAt", "date"),
  ], ["reference", "remindDaysBefore", "reminderSentAt", "expenseId", "notes", "createdAt", "updatedAt"]),

  T("CapitalEntry", "Investor contribution.", [
    c("id"), c("investor"), c("amountAED", "aed"), c("contributedOn", "date"), c("notes"),
  ], ["createdAt", "updatedAt"]),

  T("ShopOrder", "Online storefront order.", [
    c("id"), c("customerName"), c("emirate"), c("itemCount", "int"), c("totalAED", "aed"),
    c("paymentMethod"), c("status", "enum", "PENDING|CONFIRMED|SHIPPED|DELIVERED|CANCELLED"), c("createdAt", "date"),
  ], ["clientRequestId", "phone", "email", "address", "items", "notes", "updatedAt"]),

  T("StaffLeave", "Staff leave record.", [
    c("id"), c("staffId"), c("startDate", "date"), c("endDate", "date"), c("days", "int"), c("type"), c("note"), c("createdAt", "date"),
  ]),
];

/**
 * Models in schema.prisma the assistant must NEVER see. The drift test asserts that every model
 * is either exposed above or listed here — so adding a table is a conscious decision.
 */
export const EXCLUDED_TABLES: ReadonlySet<string> = new Set([
  "StaffDocument", "CompanyDocument", // passport/visa/tax scans — file URLs are effectively public if leaked
  "AdminUser",                        // holds passwordHash
  "AttendancePunch",                  // biometric pins
  "BlogPost", "Keyword", "BlogTopic", // marketing content, not business questions
  "WorkingHours", "BlockedSlot", "SalonSettings", "PageStat",
  "AssistantQuery",                   // the assistant's own cache — not business data
]);

/** Never allowed as any token, in any casing or position — belt over the braces. */
export const DENY_TOKENS: ReadonlySet<string> = new Set([
  "passwordhash", "passportnumber", "passportexpiry", "emiratesid", "emiratesidexpiry",
  "labourpermitnumber", "labourcardnumber", "passportpiclink", "biometricpin",
  "staffdocument", "companydocument", "adminuser", "attendancepunch",
  "fileurl", "pathname", "receipturl", "receipturls", "receiptpath", "receiptpaths",
]);

export const ALLOWED_TABLES: ReadonlySet<string> = new Set(SCHEMA_TABLES.map((t) => t.table));
export const ALLOWED_COLUMNS: ReadonlySet<string> = new Set(SCHEMA_TABLES.flatMap((t) => t.cols.map((x) => x.n)));
/** Lowercased union, for checking bare (unquoted) identifiers. */
export const ALLOWED_LC: ReadonlySet<string> = new Set(
  [...ALLOWED_TABLES, ...ALLOWED_COLUMNS].map((s) => s.toLowerCase()),
);

const KIND_BY_COL = new Map<string, ColKind>(
  SCHEMA_TABLES.flatMap((t) => t.cols.map((x) => [x.n.toLowerCase(), x.t] as const)),
);
/** Column kind for output formatting (AED vs date vs plain number). */
export function columnKind(col: string): ColKind | null {
  return KIND_BY_COL.get(col.toLowerCase()) ?? null;
}

/** The schema section of the prompt — one dense line per table. */
export function schemaCardText(): string {
  return SCHEMA_TABLES.map((t) => {
    const cols = t.cols.map((x) => (x.v ? `${x.n}:${x.v}` : x.n)).join(",");
    return `"${t.table}"(${cols}) ${t.note}`;
  }).join("\n");
}
