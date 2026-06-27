# GoDaddy DNS records — qasralsharsalon.com

Add these in **GoDaddy → qasralsharsalon.com → DNS → Manage DNS**. In the Name/Host field enter only the short part (GoDaddy appends the domain). TTL: default.

## Part 1 — Site (Vercel) — makes the site live
| Type | Name | Value | Priority |
|---|---|---|---|
| A | `@` | `76.76.21.21` | — |
| CNAME | `www` | `cname.vercel-dns.com` | — |
| CNAME | `app` | `cname.vercel-dns.com` | — |

- `qasralsharsalon.com` → public site · `app.qasralsharsalon.com` → ERP
- If a parked `A @` already exists, edit it rather than duplicating.

## Part 2 — Booking email deliverability (Resend)
| Type | Name | Value | Priority |
|---|---|---|---|
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | — |
| MX | `send` | `feedback-smtp.us-east-1.amazonses.com` | 10 |
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC5RLBUseXPuQ4CBSf7OpXKbiEraejlq+E1lhD7lS2RV/ln5izRJo2QhTUw//vYm3DAI+Wq8M4BXE19QK/TnIQqEjTTRp6nWjZvpCtE18wZzvPBNCeoDhm177EiGCiFXcSWaVYguv7+VVMtYGBq1h+Ce5RYvtjC1NzyNJvaEGazFQIDAQAB` | — |

After these resolve, the booking emails send from `bookings@qasralsharsalon.com` to all customers.

## Part 3 — Professional mailboxes (Zoho Mail, free 5 users)
1. Sign up at zoho.com/mail → **Forever Free** plan → add domain `qasralsharsalon.com`.
2. Zoho gives a **verification TXT** → add it in GoDaddy, verify.
3. Then add:

| Type | Name | Value | Priority |
|---|---|---|---|
| MX | `@` | `mx.zoho.com` | 10 |
| MX | `@` | `mx2.zoho.com` | 20 |
| MX | `@` | `mx3.zoho.com` | 50 |
| TXT | `@` | `v=spf1 include:zoho.com ~all` | — |

4. Create mailboxes: `finance@`, `hr@`, `jacqueline@`, `requisitions@`.

Resend (Part 2, `send` subdomain) and Zoho (Part 3, root) don't conflict.

## After you've added Parts 1 & 2
Tell Claude — it verifies the domain in Vercel + Resend, then switches the site to `qasralsharsalon.com` / `app.qasralsharsalon.com` and points booking emails at the new domain.
