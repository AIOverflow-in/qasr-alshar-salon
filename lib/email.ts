import "server-only";
import { Resend } from "resend";
import { SITE } from "./site";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.FROM_EMAIL || "Qasr Alshar Salon <onboarding@resend.dev>";

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
      ${SITE.hours.note}
    </div>
  </div></body></html>`;
}

function detailsTable(b: BookingEmail) {
  const row = (k: string, v: string) =>
    `<tr><td style="padding:8px 0;color:#8c8267;width:38%;">${k}</td><td style="padding:8px 0;color:#f6f0e2;font-weight:bold;">${v}</td></tr>`;
  const isHome = b.serviceMode === "HOME";
  return `<table style="width:100%;border-collapse:collapse;margin:16px 0;">
    ${row("Service", b.serviceName)}
    ${row("Location", isHome ? "Home service" : "At the salon")}
    ${isHome && b.address ? row("Address", b.address) : ""}
    ${row("Date &amp; Time", b.whenLabel)}
    ${row("Price", `AED ${b.priceAED}`)}
    ${row("Name", b.customerName)}
    ${row("Phone", b.phone)}
    ${row("Email", b.email)}
    ${b.customRequest ? row("Custom request", b.customRequest) : ""}
    ${b.notes ? row("Notes", b.notes) : ""}
  </table>`;
}

/** Confirmation to the customer + alert to the salon. Never throws. */
export async function sendBookingEmails(b: BookingEmail) {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping emails");
    return;
  }

  const customerHtml = shell(
    "Your appointment is confirmed 🎉",
    `<p style="line-height:1.7;color:#cabfa6;">Dear ${b.customerName}, thank you for booking with Qasr Alshar Salon. We can't wait to pamper you! Here are your details:</p>
     ${detailsTable(b)}
     <a href="${SITE.url}" style="display:inline-block;margin-top:8px;background:linear-gradient(120deg,#9a7a2e,#e7c878,#9a7a2e);color:#0b0a08;text-decoration:none;font-weight:bold;padding:12px 26px;border-radius:999px;">Visit our website</a>
     <p style="margin-top:18px;font-size:13px;color:#8c8267;">Need to reschedule? Reply to this email or call us at ${SITE.phones[0].label}.</p>`
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
    `<p style="line-height:1.7;color:#cabfa6;">Dear ${inv.clientName}, thank you for visiting Qasr Alshar Salon. Your invoice <b style="color:#f6f0e2;">${inv.invoiceNo}</b> is attached as a PDF.</p>
     <table style="width:100%;border-collapse:collapse;margin:16px 0;">
       <tr><td style="padding:8px 0;color:#8c8267;width:38%;">Invoice</td><td style="padding:8px 0;color:#f6f0e2;font-weight:bold;">${inv.invoiceNo}</td></tr>
       <tr><td style="padding:8px 0;color:#8c8267;">Total paid</td><td style="padding:8px 0;color:#f6f0e2;font-weight:bold;">AED ${inv.totalAED.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>
     </table>
     <a href="${inv.publicUrl}" style="display:inline-block;margin-top:8px;background:linear-gradient(120deg,#9a7a2e,#e7c878,#9a7a2e);color:#0b0a08;text-decoration:none;font-weight:bold;padding:12px 26px;border-radius:999px;">View / download invoice</a>
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
    `<p style="line-height:1.7;color:#cabfa6;">Dear ${a.customerName}, thank you for visiting Qasr Alshar Salon! To keep your <b style="color:#f6f0e2;">${a.serviceName}</b> looking its best, here are a few aftercare tips and products we love.</p>
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
