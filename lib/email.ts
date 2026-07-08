import "server-only";
import { Resend } from "resend";
import { SITE } from "./site";
import { TERMS } from "./terms";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.FROM_EMAIL || "Qasr Alshar Salon <onboarding@resend.dev>";

// Escape user-supplied values before interpolating into HTML emails — a public booking's name/notes/
// address/custom-request would otherwise inject links/markup into the salon's own inbox.
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

type BookingEmail = {
  customerName: string;
  email: string;
  phone: string;
  serviceName: string;
  priceAED: number;
  whenLabel: string; // human readable Dubai time
  notes?: string | null;
  serviceMode?: string | null; // SALON | HOME
  address?: string | null;
  customRequest?: string | null;
  ref?: string | null; // short customer-facing booking reference
  depositAED?: number; // deposit requested to secure the slot (0 / undefined = none)
};

function shell(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#0b0a08;font-family:Arial,Helvetica,sans-serif;color:#f6f0e2;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="text-align:center;padding-bottom:20px;border-bottom:1px solid #2a2417;">
      <div style="font-size:26px;font-weight:bold;letter-spacing:1px;color:#e7c878;">QASR ALSHAR</div>
      <div style="font-size:11px;letter-spacing:3px;color:#8c8267;text-transform:uppercase;">Beauty Salon · Dubai</div>
    </div>
    <h1 style="font-size:22px;color:#e7c878;margin:28px 0 8px;">${title}</h1>
    ${body}
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #2a2417;font-size:12px;color:#8c8267;line-height:1.7;">
      ${SITE.address.line1}, ${SITE.address.city}<br/>
      ${SITE.phones[0].label} · <a href="${SITE.url}" style="color:#e7c878;">${SITE.url.replace(/^https?:\/\//, "")}</a><br/>
      ${SITE.hours.note}<br/>
      <a href="${SITE.url}/terms" style="color:#8c8267;text-decoration:underline;">Terms &amp; Conditions</a>
    </div>
  </div></body></html>`;
}

function detailsTable(b: BookingEmail) {
  const row = (k: string, v: string) =>
    `<tr><td style="padding:8px 0;color:#8c8267;width:38%;">${k}</td><td style="padding:8px 0;color:#f6f0e2;font-weight:bold;">${esc(v)}</td></tr>`;
  const isHome = b.serviceMode === "HOME";
  return `<table style="width:100%;border-collapse:collapse;margin:16px 0;">
    ${b.ref ? row("Booking Ref", b.ref) : ""}
    ${row("Service", b.serviceName)}
    ${row("Location", isHome ? "Home service" : "At the salon")}
    ${isHome && b.address ? row("Address", b.address) : ""}
    ${row("Date &amp; Time", b.whenLabel)}
    ${row("Price", `AED ${b.priceAED} + 5% VAT`)}
    ${row("Name", b.customerName)}
    ${row("Phone", b.phone)}
    ${row("Email", b.email)}
    ${b.customRequest ? row("Custom request", b.customRequest) : ""}
    ${b.notes ? row("Notes", b.notes) : ""}
  </table>`;
}

/** Deposit-to-secure block for the confirmation email (only when a deposit is requested). */
function depositBlock(b: BookingEmail) {
  if (!b.depositAED || b.depositAED <= 0) return "";
  const line = (k: string, v: string) =>
    `<tr><td style="padding:4px 0;color:#8c8267;width:38%;">${k}</td><td style="padding:4px 0;color:#f6f0e2;font-weight:bold;">${esc(v)}</td></tr>`;
  const account = SITE.pay.iban
    ? `<table style="width:100%;border-collapse:collapse;margin-top:8px;">
        ${line("Amount", `AED ${b.depositAED}`)}
        ${line("Bank", SITE.pay.bank)}
        ${line("Account name", SITE.pay.accountName)}
        ${line("IBAN", SITE.pay.iban)}
        ${line("BIC", SITE.pay.bic)}
        ${b.ref ? line("Reference", b.ref) : ""}
      </table>`
    : `<p style="margin:8px 0 0;font-size:13px;color:#cabfa6;">Amount: <b style="color:#f6f0e2;">AED ${b.depositAED}</b>. Our team will share the bank transfer details with you on WhatsApp.</p>`;
  return `<div style="margin-top:22px;padding:16px 18px;border:1px solid #3a3020;border-left:3px solid #e7c878;border-radius:10px;background:#171310;">
    <div style="font-size:14px;color:#e7c878;font-weight:bold;">Secure your booking with a deposit</div>
    <p style="margin:6px 0 0;font-size:13px;color:#cabfa6;line-height:1.6;">To hold your appointment, please transfer the deposit below${b.ref ? ` using reference <b style="color:#f6f0e2;">${b.ref}</b>` : ""}. It's deducted from your final bill at the salon.</p>
    ${account}
  </div>`;
}

/** Full Terms & Conditions block for the customer confirmation email. */
function termsBlock() {
  return `<div style="margin-top:26px;padding-top:18px;border-top:1px solid #2a2417;">
    <div style="font-size:14px;color:#e7c878;font-weight:bold;margin-bottom:10px;">Terms &amp; Conditions</div>
    ${TERMS.map((s) => `<div style="margin-bottom:12px;">
      <div style="font-size:12px;color:#cabfa6;font-weight:bold;text-transform:uppercase;letter-spacing:0.04em;">${s.heading}</div>
      ${s.body.map((p) => `<div style="font-size:11px;color:#8c8267;line-height:1.6;margin-top:3px;">${p}</div>`).join("")}
    </div>`).join("")}
  </div>`;
}

/**
 * Confirmation to the customer + alert to the salon. Never throws.
 * Returns whether the customer confirmation actually went out, so the caller
 * can surface a soft "confirmation may be delayed" note.
 */
export async function sendBookingEmails(b: BookingEmail): Promise<{ customerEmailed: boolean }> {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping emails");
    return { customerEmailed: false };
  }

  const customerHtml = shell(
    "Your appointment is confirmed 🎉",
    `<p style="line-height:1.7;color:#cabfa6;">Dear ${esc(b.customerName)}, thank you for booking with Qasr Alshar Salon. We can't wait to pamper you! Here are your details:</p>
     ${detailsTable(b)}
     ${depositBlock(b)}
     <a href="${SITE.url}" style="display:inline-block;margin-top:18px;background:linear-gradient(120deg,#9a7a2e,#e7c878,#9a7a2e);color:#0b0a08;text-decoration:none;font-weight:bold;padding:12px 26px;border-radius:999px;">Visit our website</a>
     ${shopButton()}
     <p style="margin-top:18px;font-size:13px;color:#8c8267;">Need to reschedule? Reply to this email or call us at ${SITE.phones[0].label}.</p>
     ${termsBlock()}`
  );

  const salonHtml = shell(
    "New booking received 📅",
    `<p style="line-height:1.7;color:#cabfa6;">A new appointment has just been booked online.</p>
     ${detailsTable(b)}`
  );

  const results = await Promise.allSettled([
    resend.emails.send({
      from: FROM,
      to: b.email,
      subject: "Your Qasr Alshar appointment is confirmed",
      html: customerHtml,
    }),
    resend.emails.send({
      from: FROM,
      to: process.env.SALON_NOTIFICATION_EMAIL || b.email,
      replyTo: b.email,
      subject: `New booking — ${b.serviceName} · ${b.whenLabel}`,
      html: salonHtml,
    }),
  ]);

  results.forEach((r, i) => {
    if (r.status === "rejected")
      console.error(`[email] ${i === 0 ? "customer" : "salon"} send failed:`, r.reason);
  });

  return { customerEmailed: results[0].status === "fulfilled" };
}

type InvoiceEmail = {
  invoiceNo: string;
  clientName: string;
  clientEmail: string;
  totalAED: number;
  publicUrl: string; // token-gated, shareable
  pdf: Uint8Array;
};

/** Email the finished invoice (PDF attached + shareable link) to the client. Never throws. */
export async function sendInvoiceEmail(inv: InvoiceEmail) {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping invoice email");
    return;
  }

  const html = shell(
    "Your invoice from Qasr Alshar 🧾",
    `<p style="line-height:1.7;color:#cabfa6;">Dear ${esc(inv.clientName)}, thank you for visiting Qasr Alshar Salon. Your invoice <b style="color:#f6f0e2;">${esc(inv.invoiceNo)}</b> is attached as a PDF.</p>
     <table style="width:100%;border-collapse:collapse;margin:16px 0;">
       <tr><td style="padding:8px 0;color:#8c8267;width:38%;">Invoice</td><td style="padding:8px 0;color:#f6f0e2;font-weight:bold;">${inv.invoiceNo}</td></tr>
       <tr><td style="padding:8px 0;color:#8c8267;">Total paid</td><td style="padding:8px 0;color:#f6f0e2;font-weight:bold;">AED ${inv.totalAED.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>
     </table>
     <a href="${inv.publicUrl}" style="display:inline-block;margin-top:8px;background:linear-gradient(120deg,#9a7a2e,#e7c878,#9a7a2e);color:#0b0a08;text-decoration:none;font-weight:bold;padding:12px 26px;border-radius:999px;">View / download invoice</a>
     ${shopButton()}
     <p style="margin-top:18px;font-size:13px;color:#8c8267;">We'd love to see you again soon. Book anytime at <a href="${SITE.url}/book" style="color:#e7c878;">${SITE.url.replace(/^https?:\/\//, "")}/book</a>.</p>`
  );

  try {
    await resend.emails.send({
      from: FROM,
      to: inv.clientEmail,
      subject: `Your Qasr Alshar invoice ${inv.invoiceNo}`,
      html,
      attachments: [{ filename: `${inv.invoiceNo}.pdf`, content: Buffer.from(inv.pdf) }],
    });
  } catch (e) {
    console.error("[email] invoice send failed:", e);
  }
}

type AftercareEmail = { customerName: string; email: string; serviceName: string; products: string[] };

/** Sent after a booking is completed — aftercare tips + product recommendations. Never throws. */
export async function sendAftercareEmail(a: AftercareEmail) {
  if (!resend) { console.warn("[email] RESEND_API_KEY not set — skipping aftercare email"); return; }

  const list = a.products.length
    ? `<p style="margin-top:16px;color:#cabfa6;">Recommended aftercare to keep your look fresh:</p>
       <ul style="color:#f6f0e2;line-height:1.9;padding-left:18px;">${a.products.map((p) => `<li>${p}</li>`).join("")}</ul>`
    : "";

  const html = shell(
    "Caring for your new look 💛",
    `<p style="line-height:1.7;color:#cabfa6;">Dear ${esc(a.customerName)}, thank you for visiting Qasr Alshar Salon! To keep your <b style="color:#f6f0e2;">${esc(a.serviceName)}</b> looking its best, here are a few aftercare tips and products we love.</p>
     ${list}
     <p style="margin-top:16px;color:#cabfa6;">Message us on WhatsApp anytime for product advice or to reserve any of these — we'll set them aside for you.</p>
     <a href="${SITE.url}/book" style="display:inline-block;margin-top:14px;background:linear-gradient(120deg,#9a7a2e,#e7c878,#9a7a2e);color:#0b0a08;text-decoration:none;font-weight:bold;padding:12px 26px;border-radius:999px;">Book your next visit</a>`
  );

  try {
    await resend.emails.send({ from: FROM, to: a.email, subject: `Aftercare for your ${a.serviceName} — Qasr Alshar`, html });
  } catch (e) {
    console.error("[email] aftercare send failed:", e);
  }
}

export type DailySummary = {
  dateLabel: string; // yesterday, Dubai — e.g. "Tue, 1 Jul 2026"
  count: number; total: number; net: number; vat: number;
  byMethod: { CASH: number; CARD: number; TRANSFER: number };
  topArtist: { name: string; revenue: number } | null;
  todayLabel: string; // today, Dubai
  todayBookings: { time: string; customer: string; service: string; artist: string }[];
};

/**
 * Owner's morning digest: yesterday's takings (total, count, cash/card/transfer split, VAT held,
 * busiest artist) + today's confirmed bookings. Sent by the daily cron. Never throws.
 * Returns whether the mail actually went out.
 */
export async function sendDailySummaryEmail(to: string[], s: DailySummary): Promise<boolean> {
  if (!resend) { console.warn("[email] RESEND_API_KEY not set — skipping daily summary"); return false; }
  if (!to.length) { console.warn("[email] no digest recipients — skipping daily summary"); return false; }

  const aed = (n: number) => `AED ${n.toLocaleString("en-AE")}`;
  const row = (k: string, v: string, strong = false) =>
    `<tr><td style="padding:8px 0;color:#8c8267;width:55%;">${k}</td><td style="padding:8px 0;color:${strong ? "#e7c878" : "#f6f0e2"};font-weight:bold;text-align:right;">${v}</td></tr>`;

  const takings = `<table style="width:100%;border-collapse:collapse;margin:8px 0 4px;">
      ${row("Total takings", aed(s.total), true)}
      ${row("Bills", String(s.count))}
      ${row("Cash", aed(s.byMethod.CASH))}
      ${row("Card", aed(s.byMethod.CARD))}
      ${row("Bank transfer", aed(s.byMethod.TRANSFER))}
      ${row("Net (ex-VAT)", aed(s.net))}
      ${row("VAT held (5%)", aed(s.vat))}
      ${s.topArtist ? row("Busiest artist", `${s.topArtist.name} · ${aed(s.topArtist.revenue)}`) : ""}
    </table>`;

  const bookings = s.todayBookings.length
    ? `<table style="width:100%;border-collapse:collapse;margin:8px 0;">
        ${s.todayBookings.map((b) => `<tr>
          <td style="padding:7px 0;color:#e7c878;font-weight:bold;width:22%;">${b.time}</td>
          <td style="padding:7px 0;color:#f6f0e2;">${esc(b.customer)}<div style="color:#8c8267;font-size:12px;">${esc(b.service)} · ${esc(b.artist)}</div></td>
        </tr>`).join("")}
      </table>`
    : `<p style="color:#8c8267;line-height:1.7;">No confirmed bookings yet for today.</p>`;

  const html = shell(
    `Yesterday's takings — ${s.dateLabel}`,
    `<p style="line-height:1.7;color:#cabfa6;">${s.count === 0 ? "No bills were rung up yesterday." : `${s.count} bill${s.count === 1 ? "" : "s"} totalling <b style="color:#e7c878;">${aed(s.total)}</b>.`}</p>
     ${takings}
     <div style="margin-top:26px;font-size:14px;color:#e7c878;font-weight:bold;">Today's bookings — ${s.todayLabel}</div>
     ${bookings}
     <p style="margin-top:18px;"><a href="${SITE.url.replace("//", "//app.")}/erp/sales?range=yesterday" style="display:inline-block;background:linear-gradient(120deg,#9a7a2e,#e7c878,#9a7a2e);color:#0b0a08;text-decoration:none;font-weight:bold;padding:11px 24px;border-radius:999px;">Open Sales in the ERP</a></p>`
  );

  try {
    await resend.emails.send({ from: FROM, to, subject: `Daily takings — ${s.dateLabel} · Qasr Alshar`, html });
    return true;
  } catch (e) {
    console.error("[email] daily summary send failed:", e);
    return false;
  }
}

type DuePayment = { label: string; amountAED: number; dueLabel: string; daysUntil: number; payee?: string | null; reference?: string | null; method?: string | null };

/** Reminder to the owner about upcoming / overdue scheduled payments (rent cheques etc.). Never throws. */
export async function sendPaymentReminderEmail(to: string[], payments: DuePayment[]): Promise<boolean> {
  if (!resend) { console.warn("[email] RESEND_API_KEY not set — skipping payment reminder"); return false; }
  if (!payments.length) return false;
  const aed = (n: number) => `AED ${n.toLocaleString("en-AE")}`;
  const overdue = payments.filter((p) => p.daysUntil < 0);
  const row = (p: DuePayment) => {
    const when = p.daysUntil < 0 ? `<span style="color:#e08a8a;">Overdue by ${-p.daysUntil} day${-p.daysUntil === 1 ? "" : "s"}</span>`
      : p.daysUntil === 0 ? `<span style="color:#e7c878;">Due today</span>`
      : `Due in ${p.daysUntil} day${p.daysUntil === 1 ? "" : "s"}`;
    const meta = [p.payee ? `to ${p.payee}` : null, p.method && p.method !== "CHEQUE" ? p.method.toLowerCase() : null, p.reference ? `cheque/ref ${p.reference}` : null].filter(Boolean).join(" · ");
    return `<tr>
      <td style="padding:9px 0;color:#f6f0e2;font-weight:bold;">${p.label}<div style="color:#8c8267;font-size:12px;font-weight:normal;">${p.dueLabel}${meta ? " · " + meta : ""}</div></td>
      <td style="padding:9px 0;text-align:right;white-space:nowrap;"><div style="color:#e7c878;font-weight:bold;">${aed(p.amountAED)}</div><div style="font-size:12px;">${when}</div></td>
    </tr>`;
  };
  const total = payments.reduce((s, p) => s + p.amountAED, 0);
  const html = shell(
    overdue.length ? "Action needed: payments due" : "Upcoming payments reminder",
    `<p style="line-height:1.7;color:#cabfa6;">${payments.length} scheduled payment${payments.length === 1 ? "" : "s"} need${payments.length === 1 ? "s" : ""} your attention (make sure the cheque${payments.length === 1 ? " is" : "s are"} funded). Total <b style="color:#e7c878;">${aed(total)}</b>.</p>
     <table style="width:100%;border-collapse:collapse;margin:12px 0;">${payments.map(row).join("")}</table>
     <p style="margin-top:16px;"><a href="${SITE.url.replace("//", "//app.")}/erp/finance" style="display:inline-block;background:linear-gradient(120deg,#9a7a2e,#e7c878,#9a7a2e);color:#0b0a08;text-decoration:none;font-weight:bold;padding:11px 24px;border-radius:999px;">Open Finance</a></p>`
  );
  try {
    await resend.emails.send({ from: FROM, to, subject: `${overdue.length ? "⚠ " : ""}Payments due — Qasr Alshar Salon`, html });
    return true;
  } catch (e) {
    console.error("[email] payment reminder send failed:", e);
    return false;
  }
}

type ShopOrderEmail = { ref: string; customerName: string; email: string | null; phone: string; address: string; emirate: string | null; totalAED: number; itemCount: number };

/** Customer order confirmation + salon alert for a cash-on-delivery storefront order. Never throws. */
export async function sendShopOrderEmails(o: ShopOrderEmail): Promise<void> {
  if (!resend) { console.warn("[email] RESEND_API_KEY not set — skipping shop order email"); return; }
  const aed = (n: number) => `AED ${n.toLocaleString("en-AE")}`;
  const details = `<table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <tr><td style="padding:8px 0;color:#8c8267;width:38%;">Order</td><td style="padding:8px 0;color:#f6f0e2;font-weight:bold;">${esc(o.ref)}</td></tr>
    <tr><td style="padding:8px 0;color:#8c8267;">Items</td><td style="padding:8px 0;color:#f6f0e2;font-weight:bold;">${o.itemCount}</td></tr>
    <tr><td style="padding:8px 0;color:#8c8267;">Total (cash on delivery)</td><td style="padding:8px 0;color:#e7c878;font-weight:bold;">${aed(o.totalAED)}</td></tr>
    <tr><td style="padding:8px 0;color:#8c8267;">Deliver to</td><td style="padding:8px 0;color:#f6f0e2;font-weight:bold;">${esc(o.address)}${o.emirate ? ", " + esc(o.emirate) : ""}</td></tr>
    <tr><td style="padding:8px 0;color:#8c8267;">Phone</td><td style="padding:8px 0;color:#f6f0e2;font-weight:bold;">${esc(o.phone)}</td></tr>
  </table>`;

  const sends: Promise<unknown>[] = [];
  if (o.email) {
    sends.push(resend.emails.send({
      from: FROM, to: o.email, subject: `Your Qasr Alshar order ${o.ref} — cash on delivery`,
      html: shell("Order received 🛍️", `<p style="line-height:1.7;color:#cabfa6;">Dear ${esc(o.customerName)}, thank you for your order. We'll call you on ${esc(o.phone)} to confirm and arrange <b style="color:#f6f0e2;">cash-on-delivery</b>.</p>${details}<p style="font-size:13px;color:#8c8267;">Pay in cash when your order arrives.</p>`),
    }));
  }
  sends.push(resend.emails.send({
    from: FROM, to: process.env.SALON_NOTIFICATION_EMAIL || o.email || FROM, replyTo: o.email || undefined,
    subject: `New shop order ${o.ref} · ${aed(o.totalAED)} (COD)`,
    html: shell("New shop order 🛍️", `<p style="line-height:1.7;color:#cabfa6;">A new cash-on-delivery order just came in from ${esc(o.customerName)}.</p>${details}`),
  }));
  const results = await Promise.allSettled(sends);
  results.forEach((r) => { if (r.status === "rejected") console.error("[email] shop order send failed:", r.reason); });
}

// Optional "shop our products" button, shown only when a storefront URL is configured.
function shopButton(): string {
  if (!SITE.storefront) return "";
  return `<a href="${SITE.storefront}" style="display:inline-block;margin-top:12px;background:transparent;border:1px solid #e7c878;color:#e7c878;text-decoration:none;font-weight:bold;padding:10px 22px;border-radius:999px;">Shop aftercare & hair</a>`;
}

/** Post-service thank-you + a nudge to leave a Google review. Never throws; returns whether it sent. */
export async function sendFeedbackEmail(to: string, d: { customerName: string; serviceName: string }): Promise<boolean> {
  if (!resend) { console.warn("[email] RESEND_API_KEY not set — skipping feedback email"); return false; }
  const html = shell(
    "Thank you for visiting 💛",
    `<p style="line-height:1.7;color:#cabfa6;">Dear ${esc(d.customerName)}, we hope you loved your <b style="color:#f6f0e2;">${esc(d.serviceName)}</b> at Qasr Alshar Salon.</p>
     <p style="line-height:1.7;color:#cabfa6;">If you have a moment, a quick Google review means the world to us and helps other clients find us.</p>
     <a href="${SITE.social.googleBusiness}" style="display:inline-block;margin-top:14px;background:linear-gradient(120deg,#9a7a2e,#e7c878,#9a7a2e);color:#0b0a08;text-decoration:none;font-weight:bold;padding:12px 26px;border-radius:999px;">Rate us on Google</a>
     ${shopButton()}`
  );
  try { await resend.emails.send({ from: FROM, to, subject: "How was your visit? — Qasr Alshar Salon", html }); return true; }
  catch (e) { console.error("[email] feedback send failed:", e); return false; }
}

/** Follow-up a few weeks later: time to refresh the look — book again. Never throws. */
export async function sendRebookEmail(to: string, d: { customerName: string; serviceName: string }): Promise<boolean> {
  if (!resend) { console.warn("[email] RESEND_API_KEY not set — skipping rebook email"); return false; }
  const html = shell(
    "Time to refresh your look ✨",
    `<p style="line-height:1.7;color:#cabfa6;">Hi ${esc(d.customerName)}, it's been a few weeks since your <b style="color:#f6f0e2;">${esc(d.serviceName)}</b>. To keep it looking its best, book your next visit with us.</p>
     <a href="${SITE.url}/book" style="display:inline-block;margin-top:14px;background:linear-gradient(120deg,#9a7a2e,#e7c878,#9a7a2e);color:#0b0a08;text-decoration:none;font-weight:bold;padding:12px 26px;border-radius:999px;">Book your next visit</a>
     ${shopButton()}`
  );
  try { await resend.emails.send({ from: FROM, to, subject: "Ready for your next visit? — Qasr Alshar Salon", html }); return true; }
  catch (e) { console.error("[email] rebook send failed:", e); return false; }
}
