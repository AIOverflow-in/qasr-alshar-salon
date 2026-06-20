# Qasr Alshar Salon — Website, Booking Platform & AI SEO Blog

The official website for **Qasr Alshar Salon**, a luxury multicultural beauty
salon in Dubai (Dalmok Series Building, Exit 2, Union Metro). A fast,
mobile-first, fully SEO-optimized site with **instant online booking**, an
**admin dashboard**, **automated booking emails**, and a **blog that
auto-publishes AI-written SEO articles every alternate day**.

> Gold-on-black luxury design · English + Arabic (RTL) ready · Built to out-rank the competition organically.

---

## ✨ Features

- **Mesmerizing, mobile-first design** — gold & black luxury theme, smooth motion, sticky one-tap mobile booking bar (Book / WhatsApp / Call).
- **Instant booking system** — clients pick a service, see real-time available time-slots (Dubai timezone aware), and book in under a minute. Double-booking is prevented server-side via a capacity model.
- **Admin dashboard** (`/admin`) — overview & today's schedule, full bookings management with status control, editable services & prices, opening hours, booking settings, blocked dates, and a blog manager.
- **Automated emails** (Resend) — branded confirmation to the customer + new-booking alert to the salon, on every booking.
- **AI SEO blog** — OpenAI generates locally-relevant articles; a Netlify Scheduled Function publishes one **every alternate day** automatically. Admins can also "Generate now".
- **SEO built-in** — per-page metadata, canonical URLs, Open Graph/Twitter cards, dynamic `sitemap.xml` (incl. blog posts), `robots.txt`, and rich **JSON-LD** (HairSalon LocalBusiness, Service, FAQPage, BlogPosting, BreadcrumbList). Per-service landing pages target “<service> in Dubai” long-tail keywords.
- **Bilingual ready** — English ships complete; an Arabic + RTL toggle is built in and easily extended via `lib/i18n/dictionaries.ts`.

---

## 🧱 Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 (custom gold/black theme) |
| Database | Neon Postgres + Prisma ORM |
| Email | Resend |
| AI | OpenAI (`gpt-4.1` for blog, `gpt-image-1` for imagery) |
| Auth | Signed-JWT cookie (`jose`) + bcrypt |
| Hosting | Netlify (`@netlify/plugin-nextjs` + Scheduled Functions) |

---

## 🚀 Local Development

```bash
# 1. Install
npm install

# 2. Configure environment
cp .env.example .env      # then fill in the values (see below)

# 3. Set up the database
npx prisma db push        # create tables on Neon
npm run db:seed           # seed services, hours, settings, admin, blog topics

# 4. (Optional) regenerate the AI image set
npm run gen:images

# 5. Run
npm run dev               # http://localhost:3000
```

### Environment variables

See [`.env.example`](.env.example). Key ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | Neon pooled (runtime) & direct (migrations) URLs |
| `NEXT_PUBLIC_SITE_URL` | Public site URL (used for SEO/canonical/sitemap) |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Primary WhatsApp booking line |
| `OPENAI_API_KEY` / `OPENAI_BLOG_MODEL` | Blog + image generation |
| `RESEND_API_KEY` / `FROM_EMAIL` / `SALON_NOTIFICATION_EMAIL` | Transactional email |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` / `AUTH_SECRET` | Admin login |
| `CRON_SECRET` | Protects the blog auto-generation endpoint |

Generate an admin password hash:

```bash
node -e "console.log(require('bcryptjs').hashSync('YOUR_PASSWORD',10))"
```

---

## 🔐 Admin

- URL: `/admin` (login at `/admin/login`)
- Default credentials (seeded): `admin@qasralshar.ae` / `QasrAlshar@2026` — **change the password after first login** by updating `ADMIN_PASSWORD_HASH` and re-seeding.

Admin can manage bookings, services & prices, opening hours, booking capacity, blocked dates, and the blog (generate, publish/unpublish, delete).

---

## 📝 AI Blog Automation

- **Schedule:** `netlify/functions/scheduled-blog.mjs` runs cron `0 6 */2 * *` (06:00 UTC every alternate day) and calls the protected route `POST /api/cron/generate-blog`.
- The route picks a topic from the rotating `BlogTopic` pool, generates an SEO article with OpenAI, saves it as **published**, and revalidates the blog + sitemap.
- Manual trigger: the **Generate now** button in `/admin/blog`, or:
  ```bash
  curl -X POST "$SITE/api/cron/generate-blog" -H "Authorization: Bearer $CRON_SECRET"
  ```

---

## 📧 Email Delivery Note

The booking flow always succeeds; emails are best-effort. To deliver to **real
customer addresses**, verify a sending domain in Resend
(`resend.com/domains`) and set `FROM_EMAIL` to an address on that domain. Until
then, Resend test mode only delivers to the account owner's address.

---

## ☁️ Deployment (Netlify)

1. Connect this repo to a Netlify site (build handled by `@netlify/plugin-nextjs`).
2. Add all environment variables from `.env` to **Site settings → Environment variables**.
3. Deploy. After the first deploy, set `NEXT_PUBLIC_SITE_URL` to the live URL and redeploy.
4. The scheduled blog function appears automatically under **Functions → Scheduled**.

```bash
npm run build    # prisma generate && next build
```

---

## 📂 Project Structure

```
app/                 # routes (marketing, /book, /blog, /admin, /api)
components/          # UI, sections, admin, booking wizard
lib/                 # site config, services catalogue, prisma, auth,
                     # availability, email, openai, seo, i18n
prisma/              # schema + seed
netlify/functions/   # scheduled blog generator
scripts/             # AI image generation
public/              # generated imagery + brand assets
```

---

© 2026 Qasr Alshar Salon · Dubai, UAE.
