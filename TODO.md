# Qasr Alshar — Pending To-Do

_Open action items from the Jacqueline meetings + build sessions.
Everything already shipped is omitted. Last updated: 9 Jul 2026._

Legend — **Owner:** who does it · status: `[ ]` open · `[~]` in progress / partial · `[x]` done · `[blocked]`

---

## 1. Waiting on Chethan/Jacqueline (dev is ready — just need the answer)

- [ ] **TRN number on invoices** — invoices print "TRN — PENDING" until `VAT_TRN` is set. VAT 5% is computed correctly and wording is now "prices exclusive of VAT; 5% added at checkout".
  **Owner:** Jacqueline (provide TRN) → Chethan (1 env value).
- [ ] **Recompute 5 legacy commissions** — 5 old bills over-credit ~AED 64 total (product-inclusive, pre "services-only" rule). Decision: correct them or leave.
  **Owner:** Chethan/Jacqueline decision → dev applies.
- [ ] **Jacqueline's login role** — confirm she's on an Admin/Owner login (full access) with her own private password, not STYLIST.
  **Owner:** decision → dev switches (quick).
- [x] **Super-admin password reset** — reset to a new private password (3 Jul 2026); no longer the value shared with crown artists.
- [ ] **Artist login passwords** — the 16 artist logins still share the OLD admin-password value. Rotate to a separate shared "artist" password.
  **Owner:** decision → dev rotates.
- [x] **Add-staff UI (onboard new marketers/artists)** — "Add staff" button + form on `/erp/staff` (name, role, phone, salary, commission %, referral %, joined-on); managers only. New staff are immediately bookable and flow into commissions + payroll. **(done 9 Jul 2026)**

## 2. Blocked externally

- [blocked] **WhatsApp automation** — automated confirmations/reminders. Needs **Meta Business approval** for the WhatsApp Cloud API. Manual "WhatsApp" buttons work meanwhile.
- [blocked] **AI social auto-replies** — parked by Jacqueline until marketing reach grows.

## 3. Optional software (dev can do when prioritized)

- [~] **On-page SEO** — per-page metadata, JSON-LD and sitemap.xml are already in place. Can extend (more structured data, OG images) if we want to push ranking further.
  **Owner:** dev.
- [ ] **AI staff images in the gallery** — a couple of realistic AI staff photos for representation.
  **Owner:** dev (+ Jacqueline sign-off on look).
- [ ] **Biometric Phase 2** — once the ZKTeco terminal is pointed at us and real punches validate: auto late/absent → payroll deductions + "who hasn't clocked in" alerts. (Ingest + attendance page already shipped.)
  **Owner:** dev, after on-site device config.

## 4. Ops / business (not software)

- [x] **Finalize price list** — new premium menu finalized and live (old + new both kept active). **(done 8 Jul 2026)**
- [x] **Domain + admin email** — `qasralsharsalon.com` live; `admin@qasralsharsalon.com` receives notifications. _(Confirm the mailbox actually receives — MX set — so alerts land.)_
- [ ] **Google Business profile + Maps listing** — create + verify.  **Owner:** Chethan.
- [ ] **Initial Google reviews** — gather from staff to seed credibility. (Post-service feedback email already nudges customers to Google.)  **Owner:** Chethan/Jacqueline.
- [ ] **Upload service images to Drive + hyperlink in the price sheet.**  **Owner:** Gifty / Jacqueline.
- [ ] **VAT filing paperwork** — bank statements, expenses, declaration for auditors.  **Owner:** Jacqueline.
- [ ] **Marketing outreach** — targeted campaign, African market → Middle East.  **Owner:** Jacqueline (+ Chethan strategy).
- [ ] **Hire diverse staff** — recruit ≥2 non-Black stylists (via Passport to Beauty).  **Owner:** Jacqueline.
- [ ] **Review the Scribe Desk email** Chethan sent.  **Owner:** Jacqueline.

## 5. On-site (hardware)

- [ ] **Point the ZKTeco biometric terminal at us** — set its Cloud Server/ADMS to `app.qasralsharsalon.com` (HTTPS, Dubai timezone), do a test scan, confirm the serial, then dev locks `BIOMETRIC_DEVICE_SNS` and maps each staff PIN in `/erp/attendance`.
  **Owner:** Gifty on-site → dev locks + maps.

---

### Recently shipped (for reference — no action needed)
Booking deposits (optional bank transfer) · recurring rent expense + reminders · document vault · security
hardening · super-admin dashboard graphs · **e-commerce /shop (COD + shareable product links + orders)** ·
biometric attendance ingest (ZKTeco ADMS) · notifications → admin@qasralsharsalon.com · **premium price-list
refresh + VAT-exclusive wording** · thematic AI blog hero images · kept all old + new services live +
"Locs & Dreadlocks" discoverable + fuzzy service search · ERP new-booking searchable picker ·
**mobile-responsiveness fixes (public + ERP)**.
