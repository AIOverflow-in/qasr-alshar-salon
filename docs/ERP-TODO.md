# Qasr Alshar ERP — To-do

Everything outstanding, in one place. Last reviewed **31 August 2026**.

**How to use this file**

- Ask for an item by its ID: *"Claude, do ERP-07"*
- Close one: *"Claude, close ERP-07"* — it moves to [Done](#done) with the date
- Add one: *"Claude, add … to the to-do"*

Each item says what it is, why it matters, and what is blocking it. **Blocked** means
someone outside the dev work has to act first — those cannot be started by asking.

| Status | Meaning |
|:--:|---|
| 🔴 | Costing money or risk right now |
| 🟠 | Worth doing soon |
| 🟡 | Nice to have |
| ⛔ | Blocked on someone else |
| 🤔 | Needs a decision from Jacqueline |

---

## 🔴 Costing money or risk right now

### ERP-01 · Rotate the Neon database password
The production connection string was pasted into a chat on 29 Aug. It is the **owner**
account — full read/write over every client record, staff passport detail and payroll figure.

**Do:** Neon Console → Roles → `neondb_owner` → Reset password. Then update `DATABASE_URL`
**and** `DIRECT_URL` on **both** Vercel projects and redeploy. Change both, or migrations
break quietly while the app keeps running.
**Effort:** 15 min · **Blocked on:** you

### ERP-02 · Chase the 12 unbilled past bookings — AED 2,458
Past appointments still marked confirmed. Each is either work done and never charged, or a
no-show never marked. Until they are closed the revenue figures understate reality and the
no-show rate is unknown. It grew from 11 → 12 while we watched.

**Do:** Gifty confirms each one; bill it or mark no-show. Message already drafted.
**Effort:** one afternoon · **Blocked on:** Gifty

### ERP-03 · Blog images fail 47% of the time
14 of the last 30 posts fell back to a stock photo. The written posts are fine. The prompt
correctly asks for thematic, diverse imagery — so this is a generation or storage fault,
not a wording problem. **Needs ERP-04 first** to diagnose properly.
**Effort:** half a day once logs work

### ERP-04 · Runtime logs cannot be read
`vercel logs` streams indefinitely and times out, so no runtime errors can be inspected.
This is why ERP-03 is still undiagnosed. Flying blind on production errors is the bigger
risk of the two.
**Effort:** half a day

### ERP-05 · Add four missing database indexes
Full table scans: `Booking` 32,380 · `Staff` 21,373 · `OrderLine` 12,151 · `Product` 11,745.
Harmless at 13 MB, painful later. Cheap and safe to do now, disruptive under load.
**Effort:** 1 hour

---

## 🟠 Worth doing soon

### ERP-06 · Ad attribution — know which ads bring paying clients
**Nothing** records where a client came from. No Google Analytics tag, no referrer, no UTM.
169 new clients last month, source unknown for every one.

Capture `utm_source`, `utm_campaign`, `gclid`, `ttclid` and referrer on landing → carry
through the booking form → store on the booking and client. Log spend as a Marketing
expense (the category exists and is empty). Gives spend → clients → revenue → return,
per campaign.

Works for **TikTok, Google and Instagram on day one**, because it measures our side, not
theirs. No third-party approval needed.
**Effort:** 2–3 days · **Do this before ERP-07**

### ERP-07 · Unified ad manager (TikTok · Google Ads · Instagram)
Pull spend, clicks and impressions from each platform into one ERP page. Each is a separate
integration with its own approval: Google Ads developer token (1–3 weeks), Meta app review
for `ads_read` (1–2 weeks), TikTok developer app (1–2 weeks).

⚠️ This only removes manual data entry — it adds **no insight** on its own. The platforms
cannot see bookings, so they can never tell you which ad produced a paying client. That
answer comes from ERP-06.
**Effort:** ~1 week per platform · **Needs:** ERP-06, then pick the platform you spend most on

### ERP-08 · Install Google Analytics (GA4)
No tag on the site at all. Vercel Analytics gives page views and time on page; GA4 adds
audience, acquisition and conversion funnels.
**Effort:** 2 hours · **Needs:** a GA4 Measurement ID

### ERP-09 · Product categories: Retail · Aftercare · In-house use
"Retail / Aftercare" exists (224 products). **In-house use does not**, so salon-consumed
stock cannot be excluded from revenue reporting.
**Effort:** half a day · 🤔 should in-house items also hide from the storefront?

### ERP-10 · Assets register — chairs, mirrors, furniture, equipment
Not started. Needed for business valuation. Separate from sellable stock.
**Effort:** 1 day

### ERP-11 · Delete 5 duplicate inventory records
`DIANE PREMIUM XXL SATIN BONNET` · `Chebe hair mask 3` · `FINDLEY` ·
`Makeba long #1/33` · `SHOWER CAPS`
**Effort:** 30 min · 🤔 confirm which copy to keep

### ERP-12 · Restock 21 empty storefront products
21 of 238 published products are out of stock and unsellable. Retail is only 8% of revenue
and the margin is thin — this is the fastest lever.
**Effort:** Jacqueline

### ERP-13 · Audit log for staff and pay edits
Nothing records who changed what. Five artists' commission went to 0% around 11 Aug and
there is **no trace** of who did it or why. Anyone with Admin access can change a pay rate
invisibly.
**Effort:** 1 day

### ERP-14 · Staff records incomplete
Of 21 active staff: **12 have a phone, 9 a passport, 4 an Emirates ID.** Needed for
compliance and for WhatsApp reminders.
**Effort:** import script, 2 hours · **Blocked on:** the shared spreadsheet

### ERP-15 · Unify the website team list with the ERP
The public team page is **hardcoded**, while the ERP reads staff from the database.
Deactivating someone never removes them from the site — which is why five departed artists
were still listed. Both must currently be changed together.
**Effort:** half a day

### ERP-16 · Log the outstanding leave
`StaffLeave` is nearly empty. Grace 10 days (July) and Aminata 20 days (August) were never
recorded. The feature works; the data was never entered.
**Effort:** 15 min

---

## 🟡 Nice to have

### ERP-17 · Email Jacqueline a weekly traffic summary
Analytics exists at ERP → Analytics (335 pages tracked) but must be remembered and opened.
Nothing is pushed to her.
**Effort:** half a day

### ERP-18 · Push the three blog series harder
15 posts are plain "Hair" and 10 "Beauty Tips" against only 12 across **Hair Diaries** (2),
**Ask the Stylist** (9) and **Beauty Myth Busters** (1). The prompt says "don't force it",
so the AI mostly doesn't. Make them the default rather than the exception.
**Effort:** 2 hours

### ERP-19 · Auto-generate product images
84+ products have no photo.
**Effort:** 1 day

### ERP-20 · ERP usage time per role group
How long Admin / Reception / Crown artists each spend in the system. Designed (event-driven
beacon, not a timer) but not built.
**Effort:** 1 day

### ERP-21 · Google Maps — AI-drafted review replies
🤔 **Decide first:** auto-posting AI replies to public reviews is a reputation risk. Strong
recommendation: AI **drafts**, Jacqueline approves in one tap.
**Effort:** 2 days · **Needs:** Google Business Profile access

---

## ⛔ Blocked on someone else

### ERP-22 · WhatsApp messaging
Four Meta templates written and ready in `docs/whatsapp-templates.md`. The Twilio route
(PR #122) was scrapped.
**Needs:** Meta Business verification · Phone Number ID · WhatsApp Business Account ID ·
a permanent System User token.
⚠️ Once a number is registered to the WhatsApp Business Platform it **can no longer be used
in the WhatsApp mobile app**. Do not use Jacqueline's daily number.

### ERP-23 · Card payments (Geidea)
**No code exists and the request email was never sent.** This is the item most likely to
affect revenue and the least advanced. Everything still runs on cash and bank transfer.
**Needs:** email Geidea for the production API key, integration docs and sandbox access.

### ERP-24 · Biometric attendance
Hardware is on site. **0 punches ever recorded.**
**Needs:** Gifty runs `setup-relay.bat`, sends the PC IP address and device serial.

### ERP-25 · Terms & conditions — confirm against Nura's template
A T&C page is live at `/terms`, but nobody has checked it matches Nura's template.
**Needs:** the template.

### ERP-26 · VAT registration number
`VAT_TRN` is unset, so proper tax invoices stay disabled. CT TRN is not the same thing.
**Needs:** the VAT TRN, once registered.

### ERP-27 · The AED 500 home-service booking (30 July)
Confirmed missing from the system. 30 July has 3 bookings, all billed; no AED 500 sale that
day; and **no home-service booking has ever been recorded**.
**Needs:** Gifty to explain how it was taken and paid.

---

## 🤔 Waiting on a decision

### ERP-28 · Five artists on 0% commission
Sarah Gatibaro · Sarah Ngigi · Ruth Amisi Osome · Brian Gichuki Mugo · Stephen Musembi Mbithi.
All stopped within a day of the 11 Aug meeting. August is missing **AED 5,710** of commission
records — but because salary is a floor, restoring 40% costs only **AED 159** in real pay
(Sarah Ngigi alone).

Setting 0% achieves nothing financially; it only hides who is covering their own salary.
**Marked "all good" on 29 Aug** — reopen if that was not deliberate.

### ERP-29 · Five built features nobody uses
Ever-usage: AI assistant **1** · budgets **0** · staff loans **0** · biometric **0** ·
leave logging **2**. All specified, built, tested and shipped; none adopted.
**Decide:** train the team on two or three, or retire the rest. Either beats leaving them idle.

### ERP-30 · Three loose ends from the staff changes
- **Clovis Maniratunga** — reactivated with 40% commission, but his login is still disabled. Half state.
- **Julie Njugunas** — listed as *Receptionist* on 0% commission; you said Crown Artist.
- **Zebra & Jonte Le Chef** — created as referral partners with **0** salary; both now on
  **AED 1,000/month** with zero services. Deliberate retainer, or a mistake?
- **Facials/skincare** — Grace was the only Aesthete. Nobody is now listed for that work.

---

## Done

Newest first.

| Date | ID | What |
|---|---|---|
| 31 Aug | — | This to-do file |
| 29 Aug | — | All 5 CSV downloads open correctly in Excel; pay rule explained on the salary board and staff forms (#123) |
| 29 Aug | — | Payroll CSV shows Commission %, Basis and ex-VAT label; TOTAL row totals commission (#120) |
| 29 Aug | — | Grace Mwangi offboarded (#121) |
| 29 Aug | — | Four departed artists offboarded; a departed artist could still log in (#119) |
| 29 Aug | — | One shared role list so scripts stop drifting; referral partner script (#118) |
| 24 Aug | — | 11-page system audit PDF |
| 24 Aug | — | 4 staff logins created; Zebra + Jonte added as referral partners |
| 23 Aug | — | Billed bookings close themselves; crons consolidated into one DB wake (#117) |
