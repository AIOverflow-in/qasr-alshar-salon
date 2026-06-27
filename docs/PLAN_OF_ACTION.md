# Qasr Alshar — Plan of Action & Launch Roadmap

> Consolidated from the 27 Jun 2026 strategy meeting. The website is the **single source of truth** for bookings, billing, inventory and clients.
> **Target launch: Monday.** Runs at **$0/month** (only the domain and optional SMS cost anything).

**Live URLs**
- Public site: `qasr-alshar-salon.vercel.app` → will become **qasralsharsalon.com**
- ERP/admin: `qasr-alshar-erp.vercel.app` → will become **app.qasralsharsalon.com**
- Repo: `AIOverflow-in/qasr-alshar-salon` (both Vercel projects auto-deploy from `main`, shared Neon DB)

Status legend: ✅ Live · 🔨 Building · 🙋 Needs you · ⏳ Later

---

## 1 · Bookings — one source of truth
- 🔨 Public booking **auto-creates / links a Client** in the CRM (every booking → a customer with history)
- 🔨 **"New booking" inside the ERP** — pick existing client or create one; availability-checked with a **walk-in override toggle** (for phone/social bookings logged by reception)
- ⏳ Home-service **live-location share link** (instead of typing the address)

## 2 · Billing & commissions
- 🔨 **Multi-staff per service line** — one order, several artists (wash/cornrow/nails), each credited
- 🔨 **Marketer 5% referral commission** — credited in the bill
- 🔨 **Commissions & payroll view** — per artist/period: earned / paid / outstanding + settle + export
- ✅ Generate / edit bill from a completed booking, "Billed" badge, PDF invoice
- ✅ Rebuilt tax-invoice PDF (aligned currency, multi-page, crest, TRN, T&Cs)

## 3 · Inventory — effortless (Monday priority)
- 🔨 **Bulk CSV/Excel import + export** (load 300+ products & prices in one go)
- 🔨 **Instant edits** (no page reload) + **live low-stock** on the dashboard
- 🔨 **Single source of truth** (StockMovement ledger) + per-product history + margins + reorder list
- ✅ Add/edit products, stock in/out, search, category filter, pagination
- ✅ Stock auto-decrements on POS sale

## 4 · Live alerts & notifications
- 🔨 **In-app new-booking alert** (bell + toast) + **live dashboard** — free polling, real-time feel, $0
- ✅ **Email** confirmation on every booking (customer + salon) — Resend, free
- 🙋 **WhatsApp** auto-message to **customer + admin** — Meta Cloud API (free for our volume); needs your Meta account + number
- 🔨 **Aftercare product recommendation email** after a completed visit
- ⏳ **SMS** — the only paid channel; deferred until you want to spend

### Notifications: free vs paid
| Channel | Free? | Needs |
|---|---|---|
| In-app live alerts | ✅ free forever | nothing (polling) |
| Email | ✅ free | live now; domain to brand it |
| WhatsApp (auto) | ✅ free for our volume | Meta Cloud API (no monthly fee, ~1k chats/mo free) |
| SMS | ❌ paid | provider + UAE sender-ID — deferred |

## 5 · Public site & brand
- 🔨 **Single impressive hero image** (regenerated) — replacing the sliding showcase
- 🔨 **Floating Instagram + TikTok icons** (alongside WhatsApp; header + footer + floating)
- 🔨 **Gallery categorized by service** (dreadlocks, cornrows, boho, colored braids, henna, nails, facials, waxing, lashes, massage) with **diverse (Black & non-Black) imagery**
- ✅ Realistic AI service-card images; real named "Our Team"; lightbox gallery + SEO captions; auto-blog (natural voice)

## 6 · Deployments & access
- ✅ Public site + private ERP as **two URLs sharing one DB**
- ✅ Login lands in the **full ERP**; role-based access (Super Admin all; Reception/Stylist/Investor scoped)
- ✅ 386 clients imported · mobile-responsive ERP

## 7 · Infrastructure (your side)
- ✅ Domain **qasralsharsalon.com** bought (GoDaddy) + added to both Vercel projects
- 🙋 **Add GoDaddy DNS:** `A @ → 76.76.21.21` · `CNAME www → cname.vercel-dns.com` · `CNAME app → cname.vercel-dns.com`
- ⏳ After DNS live: switch canonical URLs + redirects to the domain; brand booking emails
- 🙋 **4 free emails** (HR, finance, Jacqueline, requisitions) via **Zoho Mail** (free, 5 users) — MX/TXT records after DNS
- ⚠️ **Do not use the GoDaddy website builder** — the domain points to our Vercel site

---

## What we need from you
1. **GoDaddy DNS** records (above) — the only thing blocking the domain going live
2. **WhatsApp (free):** Meta Business account + dedicated number → send Phone Number ID, WhatsApp Business Account ID, Access Token
3. **Inventory prices** — fill the CSV template (one-click import)
4. **Gallery images** — boho, colored braids, dreadlocks + Grace's services (facial/wax/lashes), Black & non-Black mix
5. **Telegram QR** — to finish the social QR set

## Sequence to Monday
- **This weekend (I build, no accounts needed):** booking→client · ERP new-booking · multi-staff per line · marketer commission · inventory CSV + live low-stock · live notifications · floating IG/TikTok · gallery categories · single impressive hero
- **In parallel (your team):** inventory prices (CSV) · gallery images · GoDaddy DNS · start free Meta WhatsApp account
- **Monday:** final test, deploy, go live on qasralsharsalon.com (email + in-app alerts working; WhatsApp switches on when Meta creds land)
- **After launch:** WhatsApp templates · aftercare e-commerce storefront · home-service live location · SMS (optional)

---
*Qasr Alshar Salon — Dubai's Crown of Beauty. Maintained as the working build plan.*
