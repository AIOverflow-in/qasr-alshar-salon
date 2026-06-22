# Qasr Alshar — Master Implementation Plan

> Source: Strategy meeting **21 Jun 2026** (Jacqueline Ekumba, Rachel W, Qasr, Chethan Reddy).
> Owner: Chethan (dev). This is the single source of truth for everything we build.
> Vision: turn Qasr Alshar from a salon with a website into a **systematised, premium, multi-channel beauty business** — bright authentic brand, frictionless booking, and a custom ERP that runs the operation and the finances.

---

## 0. North-Star Goals

| Goal | Target | Why it matters |
|---|---|---|
| **Monthly revenue** | **AED 100,000** (40k salaries · 20k expenses · rest = dividends) | Currently ~69–70k (peaked 80k, started 20k). Business is **not yet profitable** — 80% eaten by salaries+expenses; owner is funding rent from personal money. |
| **Time to stable product** | ~2 weeks to stable; **initial sites live in a day**; full system usable within **30 days** | Jacqueline needs a working system fast; replaces an AED 8,000 Odoo/ODU quote. |
| **ERP build cost** | **< AED/USD 1,000** | Built in-house instead of Odoo. |
| **Brand feel** | Bright, welcoming, authentic, premium | Light theme + real imagery + automation = differentiation in a crowded market. |

**Guiding principles**
1. **Every booking flows through the system** — a sale only counts if it's in the system (kills off-the-books personal-phone bookings).
2. **Authentic over artificial** — real photos/video of real work; no synthetic faces.
3. **Automate the repetitive** — WhatsApp greetings, reminders, social replies, payroll, dividends.
4. **Protect the business** — clear T&Cs, cancellation/late fees, staff safety, audit trail.
5. **Defer commercials** — no fee discussions until the software has scaled the business to profitability.

---

## 1. Workstreams Overview

| # | Workstream | Status | Priority |
|---|---|---|---|
| A | Website rebrand → **light/bright theme** | 🟡 Built on `feature/light-theme` (local) | **P0** |
| B | **Authentic imagery** (remove AI faces) | 🔴 Blocked on assets from team | **P0** |
| C | **WhatsApp** floating icon + automation | 🔴 Not started | **P0** |
| D | **Booking system v2** (stylists, reminders, cancellation, walk-ins) | 🟡 v1 live; needs v2 features | **P0/P1** |
| E | **Content & catalogue corrections** | 🔴 Blocked on Jacqueline's audit doc | **P0** |
| F | **Arabic** full localisation | 🟡 Toggle + partial; needs full translation | **P1** |
| G | **E-commerce** (aftercare products) | 🔴 Not started | **P1** |
| H | **ERP** (bookings, inventory, payroll, commissions, investor dashboard, roles) | 🔴 Basic hours/services only | **P1 (the big one)** |
| I | **Social media AI engagement** | 🔴 Not started | **P2** |
| J | **Scribe Desk** (separate product) | ⚪ Parallel track, share docs | **P2** |

Legend: 🟢 done · 🟡 in progress · 🔴 todo · ⚪ parallel/external.

---

## 2. What's ALREADY built (current state)

- Next.js site (live: **qasr-alshar-salon.vercel.app**, dark theme) + admin dashboard.
- **Light/bright theme** done on `feature/light-theme` (white surfaces, dark text, gold accents; vivid hero/imagery) — **awaiting review → merge → deploy**.
- Booking v1: instant fixed-slot booking (Dubai tz, capacity, double-booking guard), Neon Postgres + Prisma.
- Admin: bookings, services & prices, working hours/capacity/blocked dates, AI blog manager.
- Resend booking emails (test mode), OpenAI auto-blog cron (alternate days).
- Basic "ERP" primitives: services, working hours, settings, admin roles (single admin).

---

## 3. WORKSTREAM A — Website: Light/Bright Rebrand  `[Chethan]`

**Decision:** brighter, white-based theme; **gold + black become secondary accents**; must amplify the team's (dark) skin tones and read as welcoming/premium. Fonts must be readable and clearly distinct from background.

- [x] Remap palette to warm-white surfaces, dark text, contrast-tuned gold (`feature/light-theme`).
- [x] Keep hero/card photos **vivid** (dark scrim + light text) so dark skin tones are flattered, not washed out.
- [ ] Final pass on **font contrast/readability** (AA: ≥4.5:1 body, deeper gold for small text).
- [ ] **Signature-service prominence:** African braiding, dreadlocks/locs, henna featured up top; also surface cross-over services (keratin, hydrafacial) to attract non-African clients.
- [ ] Merge `feature/light-theme` → `main` → deploy after Jacqueline/Rachel sign-off.

**Acceptance:** Jacqueline + Rachel approve the light look on real screens; signature services visible above the fold; no faded imagery.

---

## 4. WORKSTREAM B — Authentic Imagery  `[Chethan + The group]`

**Decision:** transition from AI-generated photos to **real, authentic photography** of salon work and stylists. AI faces look artificial on Black skin → hurts trust.

- [ ] **Remove every synthetic human face** from the site.
- [ ] Replace with: real salon interior, real braiding/locs/wigs/henna/nails work, short brand video(s).
- [ ] Where a real photo isn't available yet → use a **name/typographic card** instead of an AI face.
- [ ] Build an image-management flow so the team can drop new media without a developer.

**🔗 Data needed (The group):** high-quality **logos**, **brand videos**, **original images** of work + salon + stylists, updated **price lists**, **detailed service descriptions**. (Owner: The group)

---

## 5. WORKSTREAM C — WhatsApp Integration & Automation  `[Chethan]`

**Decision:** persistent **floating WhatsApp icon on every page** for direct booking; automate initial responses.

- [ ] Floating WhatsApp button (all pages, mobile-first, doesn't clash with the mobile booking bar).
- [ ] Deep-link pre-fills service/date context where possible.
- [ ] **Automated greeting / auto-reply** (WhatsApp Business API or provider) that, when staff are unavailable, returns: booking instructions, available dates, and **stylist availability**.
- [ ] Booking confirmations + reminders **also via WhatsApp** (not just email — clients here live on WhatsApp).

**Open decision:** WhatsApp Business API provider (Twilio / 360dialog / Meta Cloud API) + number. *(needs owner input + budget)*

---

## 6. WORKSTREAM D — Booking System v2  `[Chethan]`

Build on the live v1. New requirements from the meeting:

### 6.1 Stylist selection
- [ ] Clients can pick a **specific stylist** during booking.
- [ ] Show **name + availability only — NO staff photos** (deliberate: prevents some stylists getting overbooked/favoured while others are neglected).
- [ ] Per-stylist availability schedules drive slots.

### 6.2 Notifications & reminders
- [ ] On booking: auto email **and WhatsApp** to **both client and salon**.
- [ ] **Reminder** the morning of the appointment (and/or 24h before).
- [ ] Status updates (confirmed / rescheduled / cancelled).

### 6.3 Cancellation & late policy (Airbnb-style, protects revenue)
- [ ] Formal **cancellation policy** with tiered fees by notice window.
- [ ] **Late penalty:** AED 100 per 30 min after a 15-minute grace period.
- [ ] **Minimum order value by location** for home services.
- [ ] Show T&Cs at booking; capture acceptance; keep an auditable history (sales-order number + WhatsApp thread) to resolve disputes.

### 6.4 Home-service logistics
- [ ] **Transport/logistics cost baked into the service price** — never charged separately (looks cheap/unprofessional). Salon presents as fully logistics-supported.
- [ ] Staff-safety features for home jobs (see ERP §8.4).

### 6.5 Walk-in management
- [ ] Reception logs **every** walk-in into the system (no off-system arrivals).
- [ ] If a requested stylist is busy → mark as walk-in; client waits until that stylist frees up **in the system**, or is offered an available stylist.
- [ ] Purpose: make it possible to tell whether a problem is **IT/technical** vs **management/implementation**.

### 6.6 Centralised-booking enforcement
- [ ] All appointments — including those originating from a stylist's personal social page — are **forced through the salon's central booking system** to count as official sales.

---

## 7. WORKSTREAM E — Content & Catalogue Corrections  `[Chethan ← Jacqueline/Qasr]`

**Decision:** standardise content; fix errors.

- [ ] Rename **"micro locks" → "sister locks"** in the service catalogue. *(Note: "Sisterlocks®" is a trademarked certified method — confirm we're certified or keep wording client-approved; flagging, not blocking.)*
- [ ] Fix pricing errors — e.g. **starter (locs) rate should be 300, not 150**; apply all corrections from the audit doc.
- [ ] Standardise terminology, descriptions, and "from" pricing across all services.
- [ ] Confirm/keep **Arabic language option** (see §9).

**🔗 Data needed:** Jacqueline/Qasr deliver a **page-by-page website audit** — screenshots + corrections + accurate copy + full service/price list — in a **formal Word document**. (Owners: Jacqueline = audit; The group = price list/descriptions)

---

## 8. WORKSTREAM H — Custom ERP (the centrepiece)  `[Chethan]`

**Decision:** build internally (< $1k) to replace Odoo/ODU. Centralises bookings + finances + staff. Targets the owner's manual-Excel pain.

### 8.1 Architecture & roles
- [ ] One platform, three access levels: **Super Admin · Admin · Staff** (+ Reception, Investor view).
- [ ] Shared data model with the booking site (single source of truth).
- [ ] Customer-facing site + internal dashboard; iterative prototype reviews **every 1–3 days**.

### 8.2 Bookings & sales
- [ ] All bookings/walk-ins/home-services consolidated; each is an **official sale** with an order number.
- [ ] No transaction is valid unless it's in the system.

### 8.3 Inventory
- [ ] Product inventory with **barcode scanning**.
- [ ] Stock levels, reorder alerts, link products to services (for aftercare recommendations — §10).

### 8.4 Staff, payroll & commissions
- [ ] Employee management + per-staff sales tracking.
- [ ] **Commission engine:** referral **5%**, stylist **sales-split (e.g. 40%)**, **tiered incentives** by sales target.
- [ ] Payroll calculation (salary + commissions + incentives).
- [ ] **Home-service staff safety:** consolidate home jobs at enterprise level, record client + address + payment + transport, so the salon is legally able to stand behind the transaction (recent incident: staff disrespected, stranded, unpaid taxi).

### 8.5 Finance & investor dashboard
- [ ] Track **AED 580,000 capital investment**, rent, utilities, visa costs.
- [ ] **Automated dividend calculation** (replace manual Excel).
- [ ] Revenue/expense/P&L views toward the **100k target** (40k salaries / 20k expenses / dividends).
- [ ] Investor-only dashboard role.

**🔗 Data needed:** Jacqueline shares **Excel sheets** (revenue + financial records) and identifies the **specific ODU demo features** to replicate. (Owner: Jacqueline)

---

## 9. WORKSTREAM F — Arabic Localisation  `[Chethan]`

- [ ] Confirmed: site includes an **Arabic option**.
- [ ] Move from partial (chrome only) → **full** Arabic for all pages + booking + RTL, professionally translated.

---

## 10. WORKSTREAM G — E-commerce (Aftercare Products)  `[Chethan]`

**Decision:** add an e-commerce page for aftercare hair products.

- [ ] Product catalogue + cart (payment can be deferred/linked later, consistent with current "no payment yet").
- [ ] **Smart recommendations:** suggest products by **service booked or hair type** (e.g. low-porosity hair) — educates clients who don't know how to maintain their hair and **moves stagnant inventory**.
- [ ] Ties into ERP inventory (§8.3).

---

## 11. WORKSTREAM I — Social Media AI Engagement  `[Chethan]`

**Decision:** replace impersonal copy-paste replies with AI that writes **human-like, custom** responses using salon context.

- [ ] AI responder for likes/comments/DMs → never ignore a lead.
- [ ] Stylists must **collaborate-post** with the salon account; bookings from personal pages routed to central system.
- [ ] **Enforced via updated employment contracts** (mandate collaborative posts; receptionists log all arrivals as walk-ins if not in system).

---

## 12. WORKSTREAM J — Scribe Desk (parallel/external)  `[Chethan]`

- [ ] Share Scribe Desk **documentation** with Jacqueline.
- [ ] Demo to professional networks (Kenya doctor groups, gynecologist, father's neurologist onboarding after end-of-month consult).
- [ ] Not part of the salon system — tracked separately to avoid scope creep.

---

## 13. Phased Roadmap

### Phase 0 — Now → 48h (unblock + visible wins)
- [ ] Merge & deploy **light theme**.
- [ ] Add **floating WhatsApp** icon (manual link first; automation next).
- [ ] Apply known content fixes (sister locks, 300 starter price) pending full audit.
- [ ] **Request all assets/data** from the team (logos, video, images, price list, stylist names+availability, Excel financials, social links, ODU feature list, T&Cs).

### Phase 1 — Week 1–2 (booking v2 + ERP core → "stable product")
- [ ] Replace AI faces with real media as it arrives.
- [ ] Stylist selection (names + availability), WhatsApp + email notifications, reminders.
- [ ] Cancellation/late policy + walk-in flow + centralised-booking enforcement.
- [ ] ERP core: roles, consolidated bookings/sales, basic inventory, staff + commission engine.
- [ ] Iterative prototype reviews every 1–3 days.

### Phase 2 — Week 3–4 (finance + commerce + growth)
- [ ] Investor/finance dashboard + automated dividends + P&L.
- [ ] Inventory barcode + aftercare e-commerce with smart recommendations.
- [ ] Full Arabic localisation.
- [ ] WhatsApp/social AI auto-responses.

### Phase 3 — Ongoing (scale)
- [ ] Hire-driven service expansion (lashes, nails — competitor does 150k/mo on these alone).
- [ ] Home-service online booking as competitive edge.
- [ ] Premium touches: automated feedback links, premium messaging, brand polish.

---

## 14. Blocking Dependencies (must come from the team)

| Item | Owner | Needed for |
|---|---|---|
| HQ logos, brand video, real images | The group | B (imagery), A |
| Page-by-page content audit (Word doc) + price corrections | Jacqueline / Qasr | E (content) |
| Service price list + detailed descriptions | The group | E, booking |
| Stylist **names + availability** (NO photos) | The group | D (stylist selection) |
| Excel financial/revenue sheets | Jacqueline | H (finance dashboard) |
| Specific **ODU/Odoo features** to replicate | Jacqueline | H (ERP scope) |
| Full **T&Cs** (cancellation, late, min-order, location rules) | Jacqueline | D (policies) |
| Social media links + collaboration policy | Jacqueline | I |
| WhatsApp Business number + API provider choice | Owner | C |

---

## 15. Open Questions / Decisions Needed
1. **WhatsApp API provider** + number (Meta Cloud API vs Twilio vs 360dialog) and monthly budget.
2. **Payments**: still deferred? E-commerce + cancellation fees eventually need a gateway (Stripe/Telr/PayTabs for UAE).
3. **"Sisterlocks®" trademark** — are we certified, or is client-approved naming acceptable?
4. **ERP hosting** — same Vercel/Neon stack, or a dedicated backend for heavier finance/inventory workloads?
5. **Stylist availability source of truth** — managed in-system by admin, or self-served by stylists?
6. **Data residency** — any UAE requirement to keep client/financial data in-region?

---

## 16. Risks & Mitigations
- **Asset delay blocks authenticity + content** → ship structure now with name-cards/placeholders; swap media on arrival.
- **ERP scope creep** (finance + inventory + payroll + commissions + investors is large) → ship in thin vertical slices; review every 1–3 days; keep Scribe Desk separate.
- **Adoption failure** (staff keep booking on personal phones) → enforce via contracts + reception walk-in logging; system must be *easier* than the old way.
- **Trust** (past fraud experience w/ "Wistak") → frequent demos, transparent progress, no upfront commercial asks.
- **Seasonality/geopolitics** (clientele on unpaid leave) → recovery expected ~September; build for the upswing.

---

*Living document — update as decisions land and assets arrive.*
