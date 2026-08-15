# WhatsApp message templates — for Meta approval

Submit these in **Meta Business Manager → WhatsApp Manager → Message templates**.
Approval usually takes a few hours to two days.

## Before submitting

- **Language:** English (`en`) — add Arabic later once these are approved.
- **Category matters for cost.** Everything below is **UTILITY** (tied to a booking the customer
  made), which is roughly 80–90% cheaper than MARKETING. Do not add offers, discounts or "book now"
  language to these — Meta will reclassify them as marketing and the price jumps.
- Keep the variable order exactly as written; the ERP fills them in that order.

---

## 1. `booking_confirmed` — UTILITY

Sent immediately when a booking is made.

**Body**
```
Hello {{1}}, your appointment at Qasr Alshar Salon is confirmed.

Service: {{2}}
When: {{3}}

We look forward to seeing you. Reply to this message if you need to change anything.
```

| Variable | Example |
|---|---|
| {{1}} | Aisha |
| {{2}} | Knotless Braids |
| {{3}} | Thu 14 Aug, 1:30 pm |

---

## 2. `booking_reminder` — UTILITY

Sent the day before the appointment.

**Body**
```
Hello {{1}}, a reminder of your appointment at Qasr Alshar Salon tomorrow.

Service: {{2}}
When: {{3}}

Please reply here if you need to reschedule.
```

| Variable | Example |
|---|---|
| {{1}} | Aisha |
| {{2}} | Knotless Braids |
| {{3}} | Thu 14 Aug, 1:30 pm |

---

## 3. `visit_thank_you` — UTILITY

Sent after the service is billed. Deliberately has no offer in it — that keeps it utility-priced.

**Body**
```
Thank you for visiting Qasr Alshar Salon today, {{1}}.

It was our pleasure to take care of you. If anything about your {{2}} needs attention, reply to this message and we will look after it.
```

| Variable | Example |
|---|---|
| {{1}} | Aisha |
| {{2}} | Knotless Braids |

---

## 4. `deposit_request` — UTILITY

Sent when reception requests a deposit to hold a booking.

**Body**
```
Hello {{1}}, to secure your appointment on {{2}} we ask for a deposit of AED {{3}}.

You can pay here: {{4}}

Your booking is held once the deposit is received. Reply here if you have any questions.
```

| Variable | Example |
|---|---|
| {{1}} | Aisha |
| {{2}} | Thu 14 Aug, 1:30 pm |
| {{3}} | 100 |
| {{4}} | the Geidea payment link |

---

## Why these four

They map to what the salon already does: confirm, remind, thank, and take a deposit. Reminders and
thank-yous are what actually reduce no-shows and bring people back — and because every one of them
follows a real booking, they stay in the cheap category.

## Not included on purpose

**Promotional broadcasts** ("20% off this week"). They are MARKETING category — several times the
price, no volume discount, and the fastest way to get a number reported and blocked. If Jacqueline
wants promotions later, that should be a deliberate, separate decision.

## What I need once these are approved

From Meta Business Manager:

- **Phone Number ID** (not the phone number itself)
- **WhatsApp Business Account ID**
- A **permanent access token** (System User token — not the temporary 24-hour one)

Those go into Vercel as env vars on **both** projects; then I wire the sends into the booking flow.
