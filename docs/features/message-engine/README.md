# Qasr Alshar Message Engine

> Status: MVP implemented locally — Twilio account setup and production pilot pending
> 
> Scope of this document: the WhatsApp post-service message, the message ledger that records its lifecycle, and the next-phase chatbot/SMS foundation. No application code or database migration is included in this plan.

Implementation details and the ordered engineering work are in [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md).

Twilio dashboard onboarding steps are in [`TWILIO_SETUP_GUIDE.md`](TWILIO_SETUP_GUIDE.md).

## 1. Decision

Use Twilio as the messaging provider for the next implementation phase.

The rollout is deliberately staged:

1. Start with one WhatsApp utility message after a service is completed.
2. Add reliable delivery-status tracking through Twilio callbacks.
3. Add SMS as a separate channel and sender when the salon approves the cost and UAE sender setup.
4. Add inbound WhatsApp/SMS conversations, chatbot routing, and human handoff in the following product phase.

For the first release, use Twilio Programmable Messaging. Use Twilio Conversations only when persistent two-way conversations, chatbot state, or agent handoff is actually being built. This keeps the first release small while preserving the chosen provider.

## 2. Why Twilio

| Option | Strength | Reason it is not the selected option for this roadmap |
|---|---|---|
| **Twilio** | API-first WhatsApp and SMS, inbound webhooks, status callbacks, Conversations, Studio, and Flex | Higher cost and more engineering than a ready-made inbox; the bot still needs to be built |
| Meta Cloud API | Lowest WhatsApp platform overhead and maximum direct control | WhatsApp only; SMS and chatbot/operator tooling would need separate systems |
| WATI | Ready-made WhatsApp inbox, automation, and team workflows | More SaaS dependency; current Growth pricing page says no webhooks, so status-ledger requirements need a higher plan |
| WhatChimp | API, inbox, webhooks, and a lower fixed subscription than some competitors | Smaller platform ecosystem and continued dependency on its product/workflow model |
| 360dialog | WhatsApp-specialist API with no message markup | WhatsApp-focused; SMS and chatbot/handoff still need other services or our own tooling |

Twilio is the best fit because this product is expected to become an application-owned customer conversation system, not only a broadcast/inbox tool:

- One provider family can cover WhatsApp now and SMS later.
- The API supports outbound sends, inbound messages, delivery status, read status where available, failure information, and callbacks.
- Conversations can later provide a common model for WhatsApp, SMS, and other chat channels.
- The application can keep booking, billing, consent, chatbot state, and audit data in the existing ERP rather than splitting customer history across a provider dashboard.
- A future human handoff can be implemented without replacing the provider.

Trade-off accepted: Twilio adds a provider fee on top of Meta WhatsApp fees. Current Twilio documentation lists a per-message WhatsApp fee, while SMS pricing depends on destination, sender type, and regulation. Recheck pricing before purchase because provider and Meta rates change.

Official references:

- [Twilio WhatsApp API](https://www.twilio.com/docs/whatsapp/api)
- [Twilio Programmable Messaging](https://www.twilio.com/docs/messaging)
- [Twilio Conversations](https://www.twilio.com/en-us/messaging/apis/conversations-api)
- [Twilio WhatsApp pricing](https://www.twilio.com/en-us/whatsapp/pricing)
- [Meta WhatsApp Business Platform pricing](https://whatsappbusiness.com/products/platform-pricing/)
- [WATI pricing](https://www.wati.io/pricing/)
- [WhatChimp pricing](https://whatchimp.com/pricing/)
- [360dialog plans](https://docs.360dialog.com/docs/prices-plans-and-payments)

## 3. Product scope

### MVP: post-service WhatsApp message

When a paid/completed service is recorded, the system should:

1. Create one logical outbound-message record for the booking.
2. Send the approved `visit_thank_you` utility template through Twilio.
3. Store the Twilio message identifier and initial status.
4. Receive status callbacks and update the ledger.
5. Retry transient failures without creating duplicate logical messages.
6. Expose enough history for reception/admin to answer: what was sent, when, to whom, through which provider, and what happened afterward.

The initial message remains transactional and service-specific. Promotional messages, campaigns, AI-generated offers, and arbitrary free-form business-initiated WhatsApp messages are out of scope.

### Next phase: chatbot and SMS

Add only after the MVP has reliable callbacks and consent records:

- Inbound WhatsApp and SMS webhooks.
- Conversation and customer matching by normalized E.164 phone number.
- FAQ and booking-intent routing.
- Availability lookup and booking handoff into the existing ERP.
- Human handoff to reception during configured hours.
- Fallback response when the bot cannot safely answer.
- SMS fallback for approved use cases, using a separate SMS sender configuration.
- Bot conversation history and escalation metrics.

## 4. Existing repository touchpoints

The completion event currently has more than one path. The implementation must use one shared completion/send trigger rather than adding a WhatsApp call to each screen:

- `lib/actions/admin.ts` — reception can set a booking to `COMPLETED`.
- `app/api/erp/pos/route.ts` — billing can complete a linked booking through `syncBookingToBill()`.
- `app/api/erp/pos/route.ts` — invoice edits can close a previously confirmed booking.
- `scripts/close-billed-bookings.ts` — repair utility can close old billed bookings.
- `prisma/schema.prisma` — `BookingStatus.COMPLETED`, `Booking`, `Client`, and `SalesOrder` are the source records.

The repair script must not silently send messages for historical bookings. Historical backfill, if ever wanted, is a separate approved operation with an explicit date range, dry run, test-number check, and duplicate check.

The current `Client` model has phone and marketing-consent fields, but the message engine needs channel-specific consent and opt-out history. Do not infer WhatsApp consent merely from a stored phone number.

## 5. Planned data model

The database design should be reviewed before implementation, then migrated against the local database only.

### `MessageLedger`

One row per attempted logical message. Proposed fields:

| Field group | Required data |
|---|---|
| Identity | `id`, `clientId`, optional `bookingId`, optional `salesOrderId` |
| Channel | `channel` (`WHATSAPP` or future `SMS`), `direction` (`OUTBOUND`/`INBOUND`), `purpose` (`VISIT_THANK_YOU`, `BOOKING_CONFIRMATION`, etc.) |
| Provider | `provider` (`TWILIO`), `providerMessageId`/Twilio SID, future `conversationId` |
| Recipient | normalized E.164 destination, with no phone number in application logs |
| Content | template name, template version, locale, sanitized variable values or a redacted content snapshot |
| Lifecycle | `QUEUED`, `SUBMITTED`, `SENT`, `DELIVERED`, `READ`, `REPLIED`, `FAILED`, `CANCELLED`; timestamps for each observed milestone |
| Failure/retry | provider error code, sanitized error text, attempt count, next retry time, terminal-failure flag |
| Consent | consent state used, consent source, consent timestamp, opt-out timestamp where applicable |
| Cost | provider/Meta cost if available, amount, currency, and whether it is estimated or final |
| Audit | created/updated timestamps, trigger source, correlation/idempotency key, minimal provider metadata |

The logical uniqueness rule for the MVP should prevent a second `visit_thank_you` for the same completed booking and channel. A retry updates the same logical record or creates a clearly linked attempt; it must not look like a second customer message.

### `MessageEvent`

Use an append-only status-event table for callback history:

- ledger message ID
- provider event/message ID
- event type and normalized status
- provider timestamp and receipt timestamp
- sanitized provider error information
- deduplication key
- redacted raw payload where operational debugging requires it

Do not log access tokens, authorization headers, full webhook secrets, or unredacted customer message content.

## 6. Message lifecycle

```text
Booking/Sales Order completed
        |
        v
Create idempotent QUEUED ledger record
        |
        v
Dispatcher sends approved Twilio template
        |
        +--> store Twilio SID and SUBMITTED/SENT status
        |
        v
Twilio status callback
        |
        +--> append MessageEvent
        +--> update MessageLedger snapshot
        +--> retry transient failure or mark terminal FAILED
```

Implementation constraints:

- Never call Twilio while a booking/POS database transaction is open.
- Create the queue/ledger record as part of the completion transaction where possible; dispatch afterward.
- Enforce idempotency at the database boundary.
- Keep the provider request timeout bounded and treat provider failure as non-fatal to booking completion.
- Use a small retry policy for network/temporary provider failures; do not retry invalid recipients, opt-outs, or rejected templates.
- Make one deployment the owner of scheduled dispatch/callback processing. The repository already uses `DEPLOY_TARGET` to avoid duplicate cron work across the public and ERP deployments.

## 7. Twilio setup checklist

These are account and infrastructure prerequisites. They are not code changes.

### Twilio account and security

- Create or designate the Qasr Alshar Twilio account/project.
- Enable billing with a deliberately small spending limit and usage alerts.
- Enable MFA and restrict console/API access to the required team members.
- Prefer a Twilio API Key SID/secret for the application over sharing the master auth token.
- Keep credentials in local `.env` only during local work and in the appropriate Vercel project environment settings for deployment. Never commit secrets.

### WhatsApp sender

- Decide on a dedicated Qasr Alshar business number.
- Confirm whether that number is already active in the WhatsApp or WhatsApp Business mobile app; migration/coexistence affects the onboarding path.
- Complete Twilio/Meta WhatsApp Business onboarding, business verification, display-name review, and sender registration.
- Configure the WhatsApp sender in Twilio and record the approved `whatsapp:+E164` sender address.
- Confirm the customer opt-in wording and where it is captured in the booking/ERP flow.

### Templates

- Create the transactional `visit_thank_you` template in the Twilio/Meta template workflow.
- Keep the existing approved-content direction in `docs/whatsapp-templates.md` and add Twilio content/template identifiers after approval.
- Submit Arabic as a separate locale when the English version is stable.
- Keep promotional content out of utility templates.

### Status and inbound webhooks

- Reserve one canonical HTTPS callback host for the ERP message engine.
- Configure Twilio status callbacks for outbound messages.
- Configure inbound WhatsApp webhook handling now only if the team is ready to test replies; otherwise add it with the chatbot phase.
- Validate Twilio webhook signatures.
- Store and deduplicate callback events before updating the ledger.
- For local development, use a temporary HTTPS tunnel or Twilio-supported local testing route and only test with approved internal numbers.

### SMS sender

SMS is supported by Twilio, but it is a separate channel with separate sender and pricing rules. A WhatsApp sender is not automatically an SMS sender.

- Verify UAE destination coverage, sender type, sender-ID registration, content restrictions, and throughput with Twilio before committing.
- Provision an SMS-capable number or approved sender ID.
- Decide whether SMS is fallback-only or also used for booking reminders.
- Add SMS consent, opt-out handling, delivery tracking, and per-channel cost reporting.
- Test Arabic/Unicode messages separately because encoding can change SMS segment counts and cost.

### Proposed environment names

Add these only during implementation, after the account setup is approved:

```text
TWILIO_ACCOUNT_SID
TWILIO_API_KEY_SID
TWILIO_API_KEY_SECRET
TWILIO_WHATSAPP_FROM
TWILIO_SMS_FROM
TWILIO_STATUS_CALLBACK_URL
MESSAGE_ENGINE_ENABLED
MESSAGE_ENGINE_DRY_RUN
```

The values must be different by environment where Twilio supports it. Local development should default to disabled or dry-run until a test sender and test recipient are verified.

## 8. Consent, privacy, and compliance requirements

- Record explicit channel consent and its source; a phone number alone is not consent.
- Separate transactional/service messages from marketing consent.
- Honor STOP/opt-out requests per channel and suppress future sends.
- Provide a clear human contact route when the chatbot cannot help.
- Normalize phone numbers to E.164 and avoid exposing them in logs or analytics labels.
- Redact provider payloads and message content from error logs.
- Define retention for message content, status events, and provider payloads before storing them.
- Do not send sensitive booking, payment, staff, or identity data through the chatbot without a reviewed policy.

## 9. Delivery and operational metrics

The admin view or export should eventually support:

- queued, submitted, sent, delivered, read, replied, failed, and opted-out counts
- delivery and read rate by template, channel, and date range
- median time from completion to send and from send to delivery
- failure rate grouped by provider error code
- retry count and terminal-failure count
- chatbot containment, escalation, handoff, and unresolved-intent rates
- SMS segment count and channel cost once SMS is enabled

The first release only needs ledger storage and a basic admin/export view. A full analytics dashboard is deferred until message volume justifies it.

## 10. Implementation phases

### Phase 0 — account and product decisions

- [ ] Confirm Twilio account ownership, budget ceiling, and billing alerts.
- [ ] Confirm the dedicated WhatsApp business number and onboarding path.
- [ ] Confirm the first approved template and English/Arabic policy.
- [ ] Confirm channel-consent wording and opt-out process.
- [ ] Confirm whether SMS is required as fallback in the next phase or only planned.

### Phase 1 — local ledger foundation

- [ ] Review the proposed Prisma model and simplify fields that are not needed for the first report.
- [ ] Add the ledger/event migration and indexes to the local database only.
- [ ] Add a shared completion trigger covering admin status changes and POS billing.
- [ ] Add idempotency and a disabled-by-default dispatcher.
- [ ] Add local tests for duplicate completion events, retries, opt-outs, and callback deduplication.

### Phase 2 — WhatsApp pilot

- [ ] Configure Twilio test sender/template/recipient.
- [ ] Send only `visit_thank_you` after a local test booking is completed.
- [ ] Verify Twilio SID, callback signature, status transitions, failure handling, and ledger read-back.
- [ ] Run the full test flow against the local database without any production connection.
- [ ] Obtain explicit approval before adding production credentials or deploying a sending path.

### Phase 3 — controlled production release

- [ ] Configure production Twilio credentials only in the intended deployment environment.
- [ ] Enable one utility template and a small recipient pilot.
- [ ] Monitor delivery, failures, duplicates, opt-outs, and cost for at least one operating week.
- [ ] Expand to booking confirmation/reminder templates only after the pilot is clean.

### Phase 4 — chatbot and SMS

- [ ] Add inbound webhooks and conversation records.
- [ ] Implement a narrow FAQ/booking-intent bot with deterministic booking handoff.
- [ ] Add human escalation and reception ownership.
- [ ] Provision and test the separate UAE SMS sender.
- [ ] Add SMS fallback rules only for approved, consented use cases.
- [ ] Add bot and cross-channel metrics after real usage exists.

## 11. Acceptance criteria

The WhatsApp MVP is complete only when:

- A completed, billed booking produces at most one logical `visit_thank_you` message.
- The message is sent through Twilio using an approved template.
- The ledger stores the provider SID, recipient, template, trigger, timestamps, current status, and failure details.
- Twilio callbacks are signature-validated, idempotent, and reflected in the ledger.
- Temporary failures retry safely; permanent failures do not loop.
- Opted-out or non-consented customers are not sent a message.
- Booking completion remains successful if Twilio is unavailable.
- Local verification uses only the local database and test credentials/numbers.
- No production database write or production message occurs during local setup.

## 12. Decisions still needed from the owner

1. Which dedicated WhatsApp number should be onboarded to Twilio?
2. Is the number currently connected to WhatsApp Business, and should it be migrated or coexist?
3. What monthly messaging budget and maximum daily spend should Twilio enforce?
4. Should SMS be fallback-only, or should it also send reminders?
5. What should the chatbot answer in its first release: FAQs only, booking availability, rescheduling, or all three?
6. During which hours should the bot hand conversations to reception?
