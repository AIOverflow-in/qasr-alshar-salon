# Twilio setup guide

This guide is for the first Qasr Alshar client only. It configures one Twilio WhatsApp sender and the `visit_thank_you` template used by this repository.

Do not enable production sending until the local dry-run and one approved test message have passed.

## Starting with a trial account

The trial is suitable for the first development step:

1. Keep the Twilio account in trial mode.
2. Run this repository in local dry-run mode to verify queueing, consent, idempotency, and the ledger.
3. Optionally open **Messaging → WhatsApp → Try out WhatsApp** and join the trial testing environment from a verified phone.
4. Use only Twilio's trial WhatsApp sender and pre-approved trial templates for any external test.
5. Upgrade to **Pay as you go** before registering the client's dedicated UAE number or using the client's custom `visit_thank_you` template.

Trial accounts have recipient and message restrictions, and Twilio does not allow a dedicated WhatsApp Business API sender to be onboarded on a trial account. The trial expires after 30 days. [Twilio trial restrictions](https://www.twilio.com/docs/usage/tutorials/how-to-use-your-free-trial-account) · [WhatsApp trial testing](https://www.twilio.com/docs/whatsapp/quickstart)

Do not set the trial sender as `TWILIO_WHATSAPP_FROM` for the client’s real sender. The trial sender is only for testing.

## What the client must provide

The client should own the Twilio account, Meta Business Portfolio, WhatsApp Business Account, and UAE phone number. You can complete the technical setup with delegated access.

The client must be available for:

- Meta login and approval of Twilio's access request.
- The one-time SMS or voice OTP sent to the UAE number.
- Business verification information, if Meta requests it.
- Approval of the public WhatsApp display name and message wording.

Do not request or store the client's Meta password or OTP in chat.

## Important number check

The UAE number must:

- Be able to receive SMS or voice calls for the verification OTP.
- Not be outbound-only or behind an IVR that cannot receive the OTP.
- Not currently be registered in the WhatsApp or WhatsApp Business mobile app.

Because this number is not currently on WhatsApp, it is suitable for direct registration. Once registered with WhatsApp Business Platform, it will be used through Twilio rather than the WhatsApp mobile app. [Twilio number requirements](https://www.twilio.com/docs/whatsapp/self-sign-up)

## 1. Create and upgrade the Twilio account

1. Open [Twilio Console](https://console.twilio.com/).
2. Sign up using a client-controlled business email.
3. Complete email and phone verification.
4. Choose **Pay as you go** when prompted.
5. In the Console, open **Admin → Account billing → Upgrade account**.
6. Add the client's billing details.
7. Turn on usage alerts and set a conservative monthly spending limit.
8. Enable MFA for Console users.

Do not use the free trial for the real sender. Trial restrictions are intended for prototyping and can prevent normal production testing.

## 2. Record the Account SID

1. In Twilio Console, open **Account Dashboard**.
2. Copy the **Account SID**. It begins with `AC`.
3. Keep it private. It is an identifier, but it should still not be posted publicly.

This becomes:

```text
TWILIO_ACCOUNT_SID=AC...
```

## 3. Create an API key for the application

Use an API key for the app instead of using the master Auth Token for outbound API requests.

1. Open **Account Dashboard → API keys & tokens**. If the menu is different, open **Develop → Credentials → API keys**.
2. Click **Create API key**.
3. Use:
   - **Friendly name:** `qasr-alshar-local` for local testing.
   - **Key type:** `Main` unless Twilio offers a suitably scoped restricted key for the required Messaging API operation.
4. Click **Create API key**.
5. Copy the API Key SID, beginning with `SK`.
6. Copy the secret immediately. Twilio may not show the secret again.

The application uses:

```text
TWILIO_API_KEY_SID=SK...
TWILIO_API_KEY_SECRET=...
```

Create a separate key for deployment later. Never commit either value or put it in this guide. [Twilio API key guidance](https://www.twilio.com/docs/usage/requests-to-twilio)

## 4. Register the client's UAE WhatsApp sender

This is the main onboarding step and requires the client's Meta access and phone OTP.

1. In Twilio Console, open **Messaging → Senders → WhatsApp Senders**.
2. Click **Create new sender**.
3. Under **Select a phone number to register**, choose **Your own phone number / Non-Twilio phone number**.
4. Enter the UAE number in international format, for example `+9715XXXXXXXX`.
5. Click **Continue**.
6. Click **Continue with Facebook**.
7. Keep the Twilio Console and Meta popup open in the same browser. Do not copy or share the popup URL.
8. Sign in to the client's Meta account.
9. Allow Twilio to manage the WhatsApp Business Account when Meta shows the access request.
10. Select the client's existing **Meta Business Portfolio**, or create one for the client if none exists.
11. Create a new **WhatsApp Business Account (WABA)** for Twilio. For this first sender, do not select an unrelated WABA created for another provider.
12. Create the WhatsApp Business profile.
13. Set:
    - **Business display name:** the client's approved public salon name.
    - **Category:** the closest salon/beauty category.
    - **Business description:** optional, accurate, and client-approved.
    - **Website:** the client's real website, if available.
14. Choose SMS or voice verification.
15. Have the client read the OTP from the UAE number to you during the live setup, or have the client enter it themselves.
16. Confirm Twilio's access request.
17. Wait for the sender to appear as registered in **WhatsApp Senders**.

The sender value required by the app is the WhatsApp-prefixed E.164 address:

```text
TWILIO_WHATSAPP_FROM=whatsapp:+9715XXXXXXXX
```

A WhatsApp sender is a phone number connected to a WABA. For a single direct client, Twilio Self Sign-up is the correct path; the ISV/Tech Provider process is not needed yet. [Twilio WhatsApp Self Sign-up](https://www.twilio.com/docs/whatsapp/self-sign-up)

## 5. Complete Meta business verification

1. In Meta Business settings, open **Security Center**.
2. Start **Business verification** if the portfolio is not already verified.
3. Submit the client's legal business details and requested documents.
4. Ensure the legal business name, website, address, and display name are consistent.
5. Wait for approval before production rollout.

The sender may be usable for restricted testing before verification, but verification is required for normal production scale and higher messaging limits. Start it early because review time varies. [Twilio verification guidance](https://www.twilio.com/docs/whatsapp/self-sign-up)

## 6. Create the `visit_thank_you` template

1. In Twilio Console, open **Messaging → Content Template Builder**. In the newer Console this may appear as **Products & Services → Templates**.
2. Click **Create new**.
3. Set:
   - **Template name:** `visit_thank_you`
   - **Language:** English (`en`)
   - **Content type:** text
4. Use this body exactly unless the client approves a wording change:

```text
Thank you for visiting Qasr Alshar Salon today, {{1}}.

It was our pleasure to take care of you. If anything about your {{2}} needs attention, reply to this message and we will look after it.
```

5. Add variable samples:
   - `{{1}}`: `Aisha`
   - `{{2}}`: `Knotless Braids`
6. Save the template and choose **Save and submit for WhatsApp approval**.
7. Select **UTILITY** as the category because this message follows a completed service and contains no promotion.
8. Submit it for approval.
9. Open the saved template after submission and copy its **Content SID**, beginning with `HX`.

The app expects:

```text
TWILIO_VISIT_THANK_YOU_CONTENT_SID=HX...
```

Variables must stay sequential: `{{1}}` is the customer name and `{{2}}` is the service name. [Twilio Content Template Builder](https://www.twilio.com/docs/content/create-templates-with-the-content-template-builder)

Do not configure the Arabic template until the English template and local test are working. Add Arabic as a separate locale later.

## 7. Configure the callback URL

The application sends the status callback URL with each outbound Twilio request. No Twilio Studio flow or Conversations setup is needed for this MVP.

For local testing, the URL must be an HTTPS tunnel to the local Next.js server, for example:

```text
https://YOUR-TUNNEL.example/api/webhooks/twilio/status
```

For deployment, use the final public ERP URL:

```text
https://YOUR-ERP-DOMAIN/api/webhooks/twilio/status
```

Set:

```text
TWILIO_STATUS_CALLBACK_URL=https://YOUR-PUBLIC-HOST/api/webhooks/twilio/status
```

The callback endpoint validates `X-Twilio-Signature`, records status events, deduplicates callbacks, and updates the local message ledger. Twilio must be able to reach the URL from the public internet.

## 8. Add local environment values

Add the values to `qasr-alshar-salon/.env` only. Do not paste the values into chat or commit them.

```text
MESSAGE_ENGINE_ENABLED="false"
MESSAGE_ENGINE_DRY_RUN="true"
MESSAGE_ENGINE_DISPATCH_TARGET="erp"
TWILIO_ACCOUNT_SID="AC..."
TWILIO_API_KEY_SID="SK..."
TWILIO_API_KEY_SECRET="..."
TWILIO_AUTH_TOKEN="..."
TWILIO_WHATSAPP_FROM="whatsapp:+9715XXXXXXXX"
TWILIO_VISIT_THANK_YOU_CONTENT_SID="HX..."
TWILIO_STATUS_CALLBACK_URL="https://YOUR-TUNNEL.example/api/webhooks/twilio/status"
```

`TWILIO_AUTH_TOKEN` is used only to validate Twilio callbacks. Keep it even when outbound requests use the API key.

Keep `MESSAGE_ENGINE_ENABLED=false` and `MESSAGE_ENGINE_DRY_RUN=true` while validating the local database. The app defaults to dry-run unless explicitly set to `false`.

## 9. What to send back after dashboard setup

Do not send secrets. Confirm only:

- Twilio account upgraded to Pay as you go.
- WhatsApp sender registered, including whether it is approved/active.
- `visit_thank_you` template approved, with its `HX...` SID entered locally.
- Local `.env` variables are present.
- The callback tunnel URL is running.

Then the next step is a local-only dry-run against the local database. We will verify queueing, consent, idempotency, and ledger updates before enabling a real test message.

## Not part of this setup

- Do not configure SMS yet. WhatsApp and SMS use separate sender and pricing setup.
- Do not configure Twilio Conversations or chatbot flows yet.
- Do not enable production deployment.
- Do not run tests against a production database.
