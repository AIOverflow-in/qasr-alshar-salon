# Message Engine — Engineering Implementation Plan

> Repository: `qasr-alshar-salon`  
> Branch: `feat/subhanu`  
> Provider: Twilio  
> First release: one WhatsApp utility message after service completion  
> Future release: chatbot, human handoff, and SMS

Current code status: local MVP implemented and verified. Twilio sender/template setup, real-message testing, and production enablement remain pending.

This is an implementation plan only. It authorizes no code, migration, Twilio message, deployment, or production database operation by itself.

## 1. Engineering outcome

Build a small, provider-backed message engine that can reliably answer:

- Which customer was contacted?
- Which booking or invoice caused the message?
- Which channel, template, provider, and sender were used?
- When was the message queued, submitted, sent, delivered, read, replied to, or failed?
- Did Twilio return an error, and was it retried?
- Was the customer consented at the time of sending, or opted out?
- How much did the message cost, if the provider exposes the amount?

The first release must send only the approved `visit_thank_you` WhatsApp utility template after a completed/billed service. It must not block booking completion, send duplicate messages, or send historical messages accidentally.

## 2. Scope boundaries

### Included in the first implementation

- Twilio REST client for WhatsApp template sends.
- Local-only Prisma schema and migration for the message ledger, callback events, and channel consent.
- One shared completion trigger for all current completion paths.
- Idempotent queueing and dispatch.
- Twilio status callback endpoint with signature validation and deduplication.
- Retry handling for transient failures.
- Admin/reception message history and a CSV/JSON export or equivalent read-only view.
- Unit tests and a local end-to-end test using test credentials/numbers.

### Explicitly deferred

- AI chatbot responses.
- Twilio Conversations integration.
- SMS sending.
- Marketing broadcasts and campaigns.
- Automated rescheduling or cancellation by chat.
- Full analytics dashboards.
- Historical message backfill.
- A custom agent inbox.

The deferred items are described as a follow-on plan so the MVP does not acquire speculative code or tables.

## 3. Current code paths to preserve

The same business event is currently reachable from multiple places. The implementation must centralize message queueing at the business/domain boundary and use each path only to report the completion event:

| Current path | File | Relevant behavior | Required treatment |
|---|---|---|---|
| Manual status change | `lib/actions/admin.ts` | `setBookingStatus()` updates a booking and sends an aftercare email on `COMPLETED` | Add the shared completion hook after the database change; preserve email behavior; do not call Twilio inline |
| New bill for booking | `app/api/erp/pos/route.ts` | `syncBookingToBill(..., true)` marks a linked booking completed inside a serializable transaction | Create the ledger/outbox row inside the same transaction; dispatch only after commit |
| Bill edit | `app/api/erp/pos/route.ts` | A paid bill can move a linked `CONFIRMED` booking to `COMPLETED` | Queue only when the status actually transitions to completed; do not resend on ordinary edits |
| Repair script | `scripts/close-billed-bookings.ts` | Closes old billed bookings; supports dry-run and explicit `--apply` | Do not trigger outbound messages from repair/backfill by default |
| Follow-up cron | `app/api/cron/client-followups/route.ts` | Reads completed bookings for email follow-ups | Do not couple WhatsApp sending to this email cron; use a dedicated message dispatcher |

The first implementation must inspect every caller of the completion helper before editing it. A single shared trigger is the intended root-cause integration point.

## 4. Proposed file changes

These are the expected files. The exact names can be adjusted during implementation if an existing repository pattern is a better fit.

### New application files

| File | Responsibility |
|---|---|
| `lib/message-engine/types.ts` | Shared channel, purpose, status, provider payload, and dispatch result types |
| `lib/message-engine/config.ts` | Server-only environment parsing, feature flag, dry-run behavior, sender/template configuration |
| `lib/message-engine/normalize.ts` | E.164 phone normalization and safe logging/redaction helpers |
| `lib/message-engine/ledger.ts` | Create/find/update ledger rows, idempotency key, consent check, retry eligibility, callback state transitions |
| `lib/message-engine/twilio.ts` | The only Twilio REST integration; send WhatsApp template and return normalized provider data |
| `lib/message-engine/dispatch.ts` | Claim queued rows, call the provider outside DB transactions, record attempts, schedule retries |
| `app/api/cron/message-dispatch/route.ts` | Protected dispatcher endpoint, owned by exactly one deployment |
| `app/api/webhooks/twilio/status/route.ts` | Twilio status callback parser, signature validation, event deduplication, ledger update |
| `app/erp/messages/page.tsx` | Read-only message ledger view for authorized ERP roles, if the existing navigation pattern supports it |
| `app/api/erp/messages/route.ts` | Paginated, role-protected read/export endpoint if the page needs a dedicated API |

Do not add a generic provider factory, event bus, queue product, or chatbot framework for the first provider and first message type. A single Twilio adapter and a database-backed queue are enough.

### Existing files to change

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add ledger, event, and consent models plus indexes/relations |
| `lib/actions/admin.ts` | Route manual completion through the shared queueing operation |
| `app/api/erp/pos/route.ts` | Queue on the completed transition in the transaction; do not make an external Twilio call inside it |
| `app/erp/bookings/page.tsx` or its data route | Optional link/badge to message history; keep the first UI read-only |
| `.env.example` | Document server-only Twilio variables with placeholders and safe defaults |
| `vercel.json` | Add the dispatcher schedule only after deployment ownership is confirmed |
| `netlify.toml` / scheduled-function configuration | Update only if Netlify is the active deployment and the same single-owner rule can be enforced |
| `README.md` | Add local setup and message-engine verification notes after the feature is implemented |
| `docs/whatsapp-templates.md` | Add the approved Twilio Content Template identifier and variable mapping after approval |
| `scripts/e2e.mjs` and/or `lib/message-engine/*.test.ts` | Add local tests without real outbound sends |

## 5. Database design

### 5.1 `MessageLedger`

One row represents one logical send. A retry must update or link to the same logical message and must never create an apparently new customer notification.

Recommended columns:

| Column | Type/shape | Purpose |
|---|---|---|
| `id` | `String` primary key | Internal identifier |
| `clientId` | nullable relation to `Client` | CRM customer, when known |
| `bookingId` | nullable relation to `Booking` | Triggering appointment |
| `salesOrderId` | nullable relation to `SalesOrder` | Triggering paid bill |
| `channel` | controlled value: `WHATSAPP`, future `SMS` | Delivery channel |
| `direction` | controlled value: `OUTBOUND`, future `INBOUND` | Message direction |
| `purpose` | controlled value: `VISIT_THANK_YOU`, future booking purposes | Business reason |
| `provider` | controlled value: `TWILIO` | Provider name |
| `idempotencyKey` | unique string | Prevents duplicate logical sends |
| `providerMessageId` | nullable unique string | Twilio Message SID |
| `providerConversationId` | nullable string | Reserved for chatbot/Conversations phase |
| `recipientE164` | string | Normalized destination; protected as customer data |
| `senderAddress` | string | WhatsApp sender used for the attempt |
| `templateName` | nullable string | Internal template name, e.g. `visit_thank_you` |
| `templateVersion` | nullable string | Internal version or approval revision |
| `locale` | string | `en` initially; `ar` later |
| `templateVariables` | nullable JSON | Sanitized values needed to reproduce the send |
| `status` | controlled value | Current lifecycle snapshot |
| `queuedAt` | datetime | Ledger creation time |
| `submittedAt` | nullable datetime | Provider accepted request |
| `sentAt` | nullable datetime | Twilio reported sent |
| `deliveredAt` | nullable datetime | Twilio reported delivered |
| `readAt` | nullable datetime | Twilio reported read, where available |
| `repliedAt` | nullable datetime | First related inbound reply, future phase |
| `failedAt` | nullable datetime | Terminal failure time |
| `lastErrorCode` | nullable string | Provider/application error code |
| `lastErrorMessage` | nullable string | Sanitized diagnostic text |
| `attemptCount` | integer default `0` | Dispatch attempts |
| `nextAttemptAt` | nullable datetime | Retry schedule |
| `terminalFailure` | boolean | Stops further retries |
| `consentId` | nullable relation | Consent snapshot used for send |
| `estimatedCostMinor` | nullable integer | Cost in minor currency units if known |
| `costCurrency` | nullable string | Usually `AED` or provider billing currency |
| `costFinal` | boolean | Distinguishes estimate from final amount |
| `triggerSource` | string | `ADMIN_COMPLETION`, `POS_BILLING`, etc. |
| `metadata` | nullable JSON | Minimal non-secret diagnostic data |
| `createdAt` / `updatedAt` | datetime | Audit timestamps |

Minimum indexes:

- unique `idempotencyKey`
- unique nullable `providerMessageId`
- index `(status, nextAttemptAt)` for dispatch
- index `(clientId, createdAt)` for customer history
- index `(bookingId, purpose, channel)` for dedupe and support lookup
- index `(createdAt)` for reporting

The unique key for the MVP should include booking, purpose, and channel, for example conceptually: `booking:<bookingId>:visit_thank_you:whatsapp`. It must not include a retry attempt number.

### 5.2 `MessageEvent`

Append-only callback and lifecycle history. The ledger snapshot is for fast reads; this table is the audit trail.

Recommended columns:

- `id`
- `messageLedgerId`
- `providerEventKey` unique for deduplication
- `providerMessageId`
- `eventType`
- `normalizedStatus`
- `providerStatus`
- `occurredAt` nullable provider time
- `receivedAt`
- `errorCode` nullable
- `errorMessage` nullable and sanitized
- `payload` nullable redacted JSON

Twilio callbacks may not provide a separately stable event ID for every transition. The implementation must derive a deterministic dedupe key from the provider SID, normalized status, provider timestamp/error fields, and callback payload where necessary. This must be tested against duplicate callback delivery.

### 5.3 `MessageConsent`

Consent must be separate from the existing `Client.consentMarketing` flag. Marketing consent does not automatically authorize transactional WhatsApp or SMS messaging, and a phone number does not prove consent.

Use an append-only consent record per change, with the latest row determining the current state:

- `id`
- `clientId`
- `channel` (`WHATSAPP` or `SMS`)
- `state` (`OPTED_IN`, `OPTED_OUT`, `UNKNOWN`)
- `source` (`BOOKING_FORM`, `RECEPTION`, `INBOUND_MESSAGE`, etc.)
- `capturedAt`
- `capturedById` nullable admin user
- `evidence` nullable sanitized text/metadata
- `createdAt`

Index by `(clientId, channel, createdAt)` and retain the consent row ID used by each outbound ledger record. A later implementation can add a current-state cache if volume requires it; do not add one in the MVP.

### 5.4 Relations and deletion behavior

- Deleting a client, booking, or sales order must not delete the compliance/audit record silently.
- Prefer nullable foreign keys with `SetNull` for business records and retain the recipient/template/status data in the ledger.
- Do not cascade-delete message history from a client delete operation.
- The admin UI must protect phone numbers and message content according to existing role rules.

## 6. Status state machine

### Normal path

```text
QUEUED -> SUBMITTING -> SUBMITTED -> SENT -> DELIVERED -> READ
```

`SUBMITTING` may remain an internal attempt state rather than a persisted public status if that keeps the schema smaller.

### Failure paths

```text
QUEUED/SUBMITTING -> QUEUED (future `nextAttemptAt`)
QUEUED/SUBMITTING/SENT -> FAILED
QUEUED -> CANCELLED
```

Rules:

- Status updates must be monotonic where possible. A late `SENT` callback must not overwrite `DELIVERED` or `READ`.
- A duplicate callback is a successful no-op after event deduplication.
- `FAILED` is terminal for invalid number, denied consent, rejected template, and other permanent errors.
- Network timeout, provider 5xx, and rate-limit responses are retry candidates.
- A provider “accepted” response is not proof of delivery; delivery is confirmed only by the callback.
- The message engine must never change a booking, invoice, payment, or stock status after the original completion transaction commits.

## 7. Twilio integration design

### 7.1 Provider boundary

Only `lib/message-engine/twilio.ts` may know Twilio request field names, form encoding, SIDs, provider status strings, or Twilio error formats. The rest of the application consumes normalized results:

- `accepted`
- `providerMessageId`
- `providerStatus`
- `errorCode`
- `errorMessage`
- `submittedAt`

Do not scatter Twilio calls through actions, POS routes, pages, or cron handlers.

### 7.2 Outbound WhatsApp request

The dispatcher will provide:

- `From`: configured `whatsapp:+E164` sender
- `To`: customer `whatsapp:+E164` destination
- approved Twilio/Meta template identifier or Content SID
- ordered template variables from `docs/whatsapp-templates.md`
- status callback URL

The provider adapter will return the Twilio Message SID immediately, persist it, and wait for callbacks for later status transitions.

### 7.3 Callback endpoint

`POST /api/webhooks/twilio/status` should:

1. Read Twilio's form-encoded request.
2. Validate the `X-Twilio-Signature` against the exact public callback URL and request parameters.
3. Reject invalid signatures without touching the database.
4. Locate the ledger by Twilio Message SID.
5. Insert the deduplicated `MessageEvent`.
6. Update the ledger snapshot using the monotonic state rules.
7. Return quickly with a 2xx response.

Unknown SIDs should be recorded in safe application logs or a separate diagnostic path, but must not create arbitrary customer records.

### 7.4 Dispatcher

Use the existing database and a protected scheduled route rather than adding a queue service for 10 customers/day.

Dispatcher behavior:

1. Select a small batch of `QUEUED` rows whose `nextAttemptAt` is due.
2. Claim each row atomically so two invocations cannot send the same row concurrently.
3. Check consent and recipient validity again immediately before sending.
4. Mark the attempt as in progress.
5. Call Twilio outside any Prisma transaction.
6. Save the SID and provider response, or save a retry/terminal error.
7. Continue processing the batch if one message fails.

Use a bounded batch and short execution time. The scheduled route must be protected by `CRON_SECRET`, and exactly one deployment must own it because the public and ERP deployments share a database.

## 8. Completion integration sequence

### Manual completion

1. Authenticate and authorize the reception action as today.
2. Update the booking status.
3. If the old status was not `COMPLETED` and the new status is `COMPLETED`, create the idempotent `visit_thank_you` ledger row if all eligibility conditions pass.
4. Keep the existing aftercare email best-effort behavior.
5. Return success even if the ledger or later Twilio send fails, unless the database itself failed.

### POS billing completion

1. Keep invoice creation, client totals, booking synchronization, and ledger creation in the same serializable transaction.
2. Create only the `QUEUED` ledger record inside the transaction.
3. Do not initialize the Twilio client or make an HTTP request inside the transaction.
4. Dispatch after the transaction returns successfully, through the scheduled dispatcher or a bounded post-commit trigger.
5. If a serializable transaction retries, the unique idempotency key must prevent duplicate ledger rows.

### Bill edit and repair behavior

- Queue only when the edit closes a `CONFIRMED` booking for the first time.
- An edit of an already `COMPLETED` booking must not create a new thank-you message.
- `scripts/close-billed-bookings.ts` remains dry-run by default and must not enqueue messages unless a future explicit `--send-followups` operation is designed and approved.
- No historical booking should receive a message merely because a schema or dispatcher is deployed.

## 9. Environment and configuration plan

Add server-only variables to `.env.example` only during implementation, with no real values:

| Variable | Required use |
|---|---|
| `TWILIO_ACCOUNT_SID` | Twilio account/project identifier |
| `TWILIO_API_KEY_SID` | Application REST authentication |
| `TWILIO_API_KEY_SECRET` | Application REST authentication secret |
| `TWILIO_AUTH_TOKEN` | Server-only webhook signature validation; never client-exposed |
| `TWILIO_WHATSAPP_FROM` | Registered sender, including `whatsapp:+E164` |
| `TWILIO_VISIT_THANK_YOU_CONTENT_SID` | Approved Twilio/Meta template identifier |
| `TWILIO_STATUS_CALLBACK_URL` | Public HTTPS callback URL |
| `TWILIO_SMS_FROM` | Reserved for later SMS sender; unused in MVP |
| `MESSAGE_ENGINE_ENABLED` | Global kill switch; default `false` locally |
| `MESSAGE_ENGINE_DRY_RUN` | Prevents real provider sends while exercising queue logic |
| `MESSAGE_ENGINE_DISPATCH_TARGET` | Identifies the one deployment allowed to dispatch |

Configuration rules:

- Never use `NEXT_PUBLIC_` for Twilio credentials, sender IDs, callback secrets, or customer message data.
- Local default: `MESSAGE_ENGINE_ENABLED=false` and `MESSAGE_ENGINE_DRY_RUN=true`.
- Production enablement must be an explicit environment change after pilot approval.
- Use separate Twilio test/sandbox resources and test recipients where possible.
- Do not print `.env` contents, tokens, phone numbers, or full provider payloads in logs.

## 10. Twilio account setup checklist

Complete these in order before implementation reaches a real send.

### Account and ownership

- [ ] Create or designate the Qasr Alshar Twilio account/project.
- [ ] Record account owner, billing owner, and technical administrator.
- [ ] Enable MFA and restrict console access.
- [ ] Configure spend limits, balance alerts, and usage notifications.
- [ ] Confirm the legal business name, address, website, and support contact used for verification.
- [ ] Confirm the account can send to UAE numbers and the intended customer countries.

### API authentication

- [ ] Create an application API key with the minimum required access.
- [ ] Store the API key SID/secret in the local secret store for testing and the deployment secret store for deployment.
- [ ] Retain the Auth Token only for webhook signature validation if required by the chosen Twilio validation method.
- [ ] Rotate any credential that has been exposed or shared in chat, source control, screenshots, or logs.

### WhatsApp Business sender

- [ ] Select a dedicated Qasr Alshar business phone number.
- [ ] Check whether it is currently active in WhatsApp or WhatsApp Business and decide migration/coexistence before onboarding.
- [ ] Complete Twilio/Meta WhatsApp Business onboarding and business verification.
- [ ] Submit and approve the business display name.
- [ ] Register the WhatsApp sender in Twilio.
- [ ] Record the exact `whatsapp:+E164` sender address.
- [ ] Confirm the sender's messaging limits and quality/rating status.
- [ ] Confirm the first test recipient is opted in and available for testing.

### WhatsApp template

- [ ] Map internal name `visit_thank_you` to the Twilio Content Template/Meta approved template.
- [ ] Confirm category is utility and the text remains tied to the completed service.
- [ ] Confirm variable order and locale match `docs/whatsapp-templates.md`.
- [ ] Store only the template identifier and sanitized variables in the application.
- [ ] Do not send free-form business-initiated WhatsApp content outside the applicable customer-service window.
- [ ] Submit Arabic as a separate template/locale later, after the English flow is stable.

### Webhooks

- [ ] Create one stable HTTPS status callback URL for the active deployment.
- [ ] Configure Twilio status callbacks for the outbound sender.
- [ ] Decide whether inbound callbacks are enabled in the MVP; they are required for the chatbot phase, not for the first outbound send.
- [ ] Ensure the callback route is reachable without a login page but protected by Twilio signature validation.
- [ ] Ensure the route uses the exact externally visible URL during signature validation, including scheme, host, path, and any trusted proxy configuration.
- [ ] Test duplicate, out-of-order, malformed, and invalid-signature callbacks.

### Local testing

- [ ] Use the Twilio WhatsApp Sandbox or approved test sender where suitable.
- [ ] Join/authorize the test recipient according to the Twilio sandbox instructions.
- [ ] Use an HTTPS tunnel only for local callback testing, and remove or rotate it after the session.
- [ ] Keep local `DATABASE_URL` and `DIRECT_URL` pointed at the local PostgreSQL database.
- [ ] Keep the message engine disabled/dry-run until the ledger and callback tests pass.
- [ ] Confirm test messages use only test customers and test phone numbers.

### SMS setup for the future phase

SMS is available through Twilio but is not automatically enabled by having a WhatsApp sender.

- [ ] Confirm whether the salon needs SMS fallback, SMS reminders, or both.
- [ ] Verify UAE sender-ID, long-code/short-code, registration, content, throughput, and destination requirements with Twilio.
- [ ] Provision an SMS-capable number or approved sender ID.
- [ ] Decide whether to use a Twilio Messaging Service for sender management and delivery configuration.
- [ ] Confirm SMS opt-out behavior and customer support handling.
- [ ] Test Arabic/Unicode encoding because one message may consume multiple SMS segments.
- [ ] Confirm the SMS budget separately from WhatsApp and Meta fees.

## 11. Local database and production safety gates

This feature must be developed and verified against the local database first.

### Before any schema command

- [ ] Confirm the shell is in `qasr-alshar-salon`.
- [ ] Confirm the current branch is `feat/subhanu`.
- [ ] Inspect only the database host/port from environment configuration; never print credentials.
- [ ] Confirm both `DATABASE_URL` and `DIRECT_URL` resolve to the local PostgreSQL database.
- [ ] Do not load `.env.prod` or any production environment file for local migration work.
- [ ] Keep a clean record of the pre-existing worktree changes; do not overwrite the user's `docs/whatsapp-templates.md` change.

### Local schema workflow

1. Review the proposed Prisma models.
2. Apply the migration to the local database only.
3. Run Prisma client generation.
4. Seed or create only tagged local test records.
5. Verify the migration and ledger with read-only queries.
6. Run unit and end-to-end tests.
7. Inspect `git diff`, `git diff --check`, and generated migration files.

The implementation should use the repository's normal Prisma migration workflow after confirming its current convention. Do not run a migration, `db push`, seed, repair script, or test against production during this phase.

### Production release gate

Production is a separate, later approval:

- [ ] Code review completed.
- [ ] Local migration and tests pass.
- [ ] Production database backup/rollback procedure agreed.
- [ ] Production migration reviewed and scheduled.
- [ ] Twilio production sender/template approved.
- [ ] Production secrets added only to the intended deployment environment.
- [ ] Dispatcher ownership confirmed for the two deployments sharing the database.
- [ ] `MESSAGE_ENGINE_ENABLED` remains off until the pilot window begins.
- [ ] Pilot recipient list and stop/rollback procedure agreed.

## 12. Admin and support experience

The first admin surface should be read-only and operational, not a campaign builder.

Required fields in the list/detail view:

- customer name and masked destination
- booking/invoice reference
- purpose and channel
- template and locale
- queued/submitted/sent/delivered/read/failed timestamps
- current status
- provider SID
- retry count and sanitized error
- consent state used at send time
- trigger source

Filters:

- date range
- channel
- purpose
- status
- provider error code
- booking/invoice ID

Access:

- `SUPER_ADMIN`, `ADMIN`, and authorized reception users may see operational message history.
- Investor and stylist roles must not receive unrestricted customer message content or phone data.
- No page should display API secrets or the full webhook payload.

## 13. Test plan

### Unit tests

Add focused tests for:

- UAE/international phone normalization to E.164.
- Invalid or missing phone rejection.
- Consent states: opted in, opted out, and unknown.
- Idempotency key generation.
- Duplicate completion event produces one ledger row.
- Already-completed booking does not produce a second row.
- Retryable versus terminal provider errors.
- Retry backoff and maximum attempts.
- Monotonic status transitions.
- Duplicate and out-of-order callbacks.
- Twilio signature validation success/failure using fixed test fixtures.
- Redaction of tokens, phone numbers, and payload content in logs.

### Database/integration tests

- A local completed booking creates one queued ledger record.
- A linked POS bill creates the queued row inside the same local transaction.
- A transaction retry does not duplicate the row.
- A Twilio response stores the SID and initial state.
- A callback appends one event and updates the snapshot.
- A repeated callback is a no-op.
- A provider failure does not roll back booking completion.
- An opted-out customer is skipped and receives a terminal suppressed/blocked result rather than a provider request.

### End-to-end test

Use a unique test prefix and local database cleanup, matching the existing `scripts/e2e.mjs` self-cleaning approach:

1. Create a test client, booking, and paid bill locally.
2. Complete the booking through the POS path.
3. Assert exactly one ledger row exists.
4. Run the dispatcher in dry-run mode and assert no external send occurred.
5. Run the provider adapter against a mocked Twilio response or sandbox test recipient only.
6. POST a captured status callback fixture.
7. Assert the ledger status/event history.
8. Repeat the completion request and assert no duplicate.
9. Clean up all tagged local test records.

Do not invoke an authorized production cron or real production recipient during tests.

## 14. Ordered implementation phases

### Phase A — preflight and decisions

- [ ] Confirm Twilio account ownership, budget, and WhatsApp number.
- [ ] Confirm whether the number is already attached to WhatsApp Business.
- [ ] Confirm the first template and consent wording.
- [ ] Confirm active deployment: Vercel, Netlify, or both, and which deployment owns scheduled work.
- [ ] Confirm local PostgreSQL connection and backup the user worktree state through normal Git review, not destructive commands.
- [ ] No code is written until the account and scope decisions are approved.

### Phase B — local schema and consent

- [x] Add `MessageLedger`, `MessageEvent`, and `MessageConsent` to Prisma.
- [x] Add relations and indexes.
- [x] Apply the schema to the verified local database.
- [x] Generate Prisma client.
- [x] Verify no production host was used.

### Phase C — provider adapter and ledger core

- [x] Add server-only Twilio configuration parsing.
- [x] Add phone normalization and safe redaction.
- [x] Add eligibility/consent checks.
- [x] Add idempotent ledger creation.
- [x] Add normalized Twilio send result and error classification.
- [x] Add unit tests before connecting completion paths.

### Phase D — completion and dispatcher

- [x] Integrate the shared completion trigger into manual status changes.
- [x] Integrate it into POS billing completion.
- [x] Integrate the already-confirmed-to-completed bill edit transition.
- [x] Explicitly exclude the repair script from outbound sends.
- [x] Add protected dispatcher route and one-deployment ownership.
- [x] Add bounded claim/send/update behavior.
- [x] Add retry and terminal-failure handling.

### Phase E — status callback and support view

- [x] Add signature-validated Twilio callback route.
- [x] Add event deduplication and monotonic state updates.
- [x] Add authorized read-only ERP message history.
- [ ] Add live callback, retry, and access-control integration tests after Twilio setup.

### Phase F — local pilot

- [ ] Configure local Twilio sandbox/test sender and approved test recipient.
- [ ] Keep the local database and message engine flags explicit.
- [ ] Complete a local test booking and verify the full ledger lifecycle.
- [ ] Test provider outage, invalid number, duplicate callback, and opt-out scenarios.
- [ ] Review costs and logs without exposing secrets.

### Phase G — production release, only after explicit approval

- [ ] Review the migration and rollback procedure.
- [ ] Apply production schema changes through the approved release process.
- [ ] Add production secrets to only the intended deployment.
- [ ] Enable the dispatcher with a small batch and a small pilot list.
- [ ] Monitor for duplicate sends, delivery failures, opt-outs, callback errors, and spend.
- [ ] Expand to booking confirmation/reminder templates only after the post-service pilot is stable.

## 15. Chatbot and SMS follow-on plan

Do not implement this in the MVP. When the MVP is stable:

### Chatbot code and data

- Add inbound Twilio webhook handling for WhatsApp and SMS.
- Store inbound messages in the same ledger with `direction=INBOUND`.
- Add a `Conversation` model only when there is a real need for persistent thread state.
- Link ledger rows to a conversation ID and client ID.
- Add conversation status: `BOT_ACTIVE`, `WAITING_FOR_CUSTOMER`, `HANDOFF_REQUESTED`, `HUMAN_ACTIVE`, `CLOSED`.
- Add reception ownership and handoff timestamps.
- Start with deterministic intents: hours, services, pricing, availability, booking request, reschedule request, and human help.
- Require confirmation before creating or changing a booking.
- Use the ERP as the source of truth for availability; the bot must not maintain a second schedule.
- Fail closed to reception when intent, identity, or booking state is ambiguous.

### Twilio product decision gate

- Use Programmable Messaging for simple inbound/outbound webhook flows.
- Evaluate Twilio Conversations when thread continuity, cross-channel participants, or agent handoff needs justify it.
- Do not pay for Conversations or build its state model before the chatbot requirements are confirmed.

### SMS rollout

- Add SMS consent and sender configuration independently from WhatsApp.
- Add channel-specific templates and cost/segment tracking.
- Decide whether SMS is fallback-only or a first-class reminder channel.
- Test country-specific sender compliance before customer use.

## 16. Operational runbook

### If Twilio is unavailable

- Booking, billing, and completion must continue.
- Ledger rows remain queued or retryable.
- Admin sees the failure and next attempt time.
- No manual duplicate send should be performed without checking the ledger first.

### If duplicate sends are reported

1. Stop the dispatcher with `MESSAGE_ENGINE_ENABLED=false`.
2. Check the booking's idempotency key and ledger history.
3. Check whether both deployments are dispatching.
4. Check provider SIDs and callback events.
5. Fix the claim/uniqueness issue before re-enabling.

### If a callback endpoint is attacked or misconfigured

- Disable or rotate the relevant credentials if compromise is suspected.
- Reject invalid signatures.
- Keep the endpoint free of authentication-page redirects.
- Review logs for secrets or customer-data leakage.
- Re-enable only after a signed fixture and a real test callback pass.

## 17. Definition of done

The implementation is ready for a controlled pilot only when:

- Local schema migration passes against the local database.
- No production database was used during local development or testing.
- Manual completion and POS billing both queue the same logical message correctly.
- Bill edits and repair scripts do not create accidental duplicates.
- The provider adapter is isolated and tested.
- Twilio status callbacks are signature-validated, deduplicated, and persisted.
- The ledger captures provider SID, template, destination, consent snapshot, lifecycle timestamps, retry state, and errors.
- Twilio failures never roll back a completed booking or paid invoice.
- The dispatcher has one deployment owner and is protected by `CRON_SECRET`.
- The admin view is role-protected and does not expose secrets.
- Local dry-run and sandbox tests pass.
- Twilio sender, template, webhook, budget, and consent setup are approved.
- Production enablement remains a separate explicit approval.

## 18. Owner inputs required before coding

1. Dedicated WhatsApp number and whether it is currently in WhatsApp Business.
2. Twilio account owner and billing budget.
3. Approved English template and later Arabic-template decision.
4. Consent wording and where staff will record offline consent.
5. First pilot recipients.
6. Active deployment and single dispatcher owner.
7. Whether the chatbot phase should support FAQs only, booking availability, rescheduling, or all three.
8. Whether SMS is fallback-only or also used for reminders.
