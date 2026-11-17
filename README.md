# ★ THE RISING STAR

Premium fashion house — clothing, shoes, bags, accessories and jewelry — sold on a
**pre-order** model (deposit online, balance on delivery) across Côte d'Ivoire.

This repository is an **npm-workspaces monorepo**:

```
.
├── apps/
│   ├── web/        React 19 + Vite storefront & admin dashboard   (formerly COURTLAB)
│   └── api/        Next.js 15 REST API, clean architecture         (formerly courtlab-next)
├── packages/
│   └── shared/     Domain model shared by both apps: brand, taxonomy, order
│                   statuses, pricing rules, validators, DTO types (+ unit tests)
└── supabase/
    └── migrations/ SQL migrations (run in the Supabase SQL editor)
```

## Quick start

```bash
npm install                       # installs every workspace
cp apps/api/.env.example apps/api/.env.local   # fill in Supabase, JWT, Brevo…
cp apps/web/.env.example apps/web/.env.local   # API URL, reCAPTCHA site key
npm run dev                       # web on :3000, api on :3001
```

| Command            | What it does                                   |
| ------------------ | ---------------------------------------------- |
| `npm run dev`      | Runs web + api in watch mode                   |
| `npm run build`    | Builds api then web                            |
| `npm run typecheck`| Type-checks every workspace                    |
| `npm run lint`     | ESLint                                         |
| `npm test`         | Vitest (shared domain rules + API use-cases)   |

## ⚠️ Upgrade checklist (from COURTLAB)

1. **Run the migrations** in order (both idempotent). On a brand-new Supabase project,
   `20260924000000_base_schema.sql` creates every table, the bcrypt auth RPCs
   (`create_user`, `authenticate_user`), RLS, storage buckets and default settings.
   Then `20260925000000_the_rising_star.sql` converts sizes to text (`"M"`, `"42"`, `"TU"`), adds the new
   product fields (sub-category, gender, sale price, featured, tags, materials),
   creates `contact_messages` / `newsletter_subscribers`, maps old sneaker
   categories to `shoes` and renames COURTLAB in the settings table.
   Finally `20260926000000_security_hardening.sql` adds password change and
   session revocation (`users.tokens_valid_after`, `change_user_password`).
2. **New API env vars**: `AUTH_JWT_SECRET` (≥ 32 random chars — *required*),
   `SUPABASE_SERVICE_ROLE_KEY` (recommended), `RECAPTCHA_SECRET_KEY`,
   `ADMIN_NOTIFICATION_EMAIL`, `BREVO_API_KEY`, `EMAIL_FROM`.
   **Emails — easiest: Gmail** (free, ~500/day, no new account): turn on 2-Step
   Verification on the Google account, create an app password at
   <https://myaccount.google.com/apppasswords>, then set `SMTP_USER=<the Gmail
   address>` and `SMTP_PASS=<the 16-letter app password>` (`EMAIL_FROM` optional,
   only its display name is kept). Admin → Paramètres → Notifications → « Envoyer
   un email de test » checks it. Alternative: **Brevo** with `BREVO_API_KEY` +
   a verified `EMAIL_FROM` (SMTP wins when both are set). Any other SMTP server
   works too with `SMTP_HOST` / `SMTP_PORT`.
   Optional, recommended: shared rate limits across serverless instances with
   **Upstash Redis** (free): `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
   (or Vercel KV's `KV_REST_API_URL` + `KV_REST_API_TOKEN`). Without them each
   instance counts on its own.
   **Social sign-in** (optional, each button appears once its keys are set).
   Callback URL to register with each provider:
   `https://<your-domain>/api/auth/oauth/<google|facebook|tiktok>/callback`.
   - **Google**: Google Cloud Console → APIs & Services → Credentials → OAuth
     client ID (Web application), add the callback as an authorised redirect
     URI → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
   - **Facebook**: developers.facebook.com → create an app (Consumer) → add
     Facebook Login, put the callback in "Valid OAuth Redirect URIs", ask for
     the `email` permission → `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`.
   - **TikTok**: developers.tiktok.com → create an app → add Login Kit (Web),
     register the callback, scope `user.info.basic` → `TIKTOK_CLIENT_KEY`,
     `TIKTOK_CLIENT_SECRET`. TikTok never shares an email, so new TikTok users
     type theirs once (then confirm it by email).
   Google links to an existing account with the same (verified) email;
   Facebook and TikTok don't: the user signs in with their password and links
   them from Mon compte → Sécurité. `OAUTH_CALLBACK_BASE` overrides the
   `${NEXT_PUBLIC_APP_URL}/api` default (local dev: `http://localhost:3001/api`).
   **Newsletter campaigns** (Admin → Newsletter): designed in the back-office
   (titles, text, images, videos, buttons, products, per-customer
   recommendations), sent now or at a scheduled time. A Supabase pg_cron job
   (`newsletter-dispatch`, every 5 min, migration `20261005000000`) calls
   `POST /api/cron/newsletter`; its secret lives in Supabase Vault and never
   leaves the database. One-time setup per environment:
   `select vault.create_secret('https://<domain>/api/cron/newsletter', 'newsletter_cron_url');`
   Only consenting addresses receive campaigns (newsletter sign-ups and
   customers who ticked the box); every email has a signed one-click
   unsubscribe link. Gmail SMTP sends ~500 emails/day.
3. **New web env var**: `VITE_RECAPTCHA_SITE_KEY`. Create a **reCAPTCHA v3** key at
   <https://www.google.com/recaptcha/admin> and add your domains.
4. **Admins must log in again** — sessions are now signed tokens.
5. The committed `apps/web/.env` was removed from git; set the variables in Vercel.

## Architecture

### API (`apps/api`) — clean architecture

```
src/
├── domain/            errors (no framework code)
├── application/
│   ├── ports.ts       interfaces: repositories, PaymentGateway, Mailer, CaptchaVerifier, TokenService…
│   ├── use-cases/     auth, social (Google/Facebook/TikTok), catalog, products, orders, payments, customers, dashboard, settings…
│   └── templates/     branded transactional emails
├── infrastructure/    adapters: Supabase repositories & storage, Brevo,
│                      Google reCAPTCHA, JWT (jose), rate limiter
├── interfaces/http/   route wrapper (auth, rate-limit, captcha, errors) + zod schemas
└── container.ts       composition root (the only place adapters are wired)
app/api/**/route.ts    thin controllers: validate → call a use-case → respond
```

Dependencies point inwards: routes → use-cases → ports ← adapters. Use-cases are
unit-tested with in-memory fakes (`src/application/use-cases/__tests__`).

**Security highlights**
- Every `/api/admin/*` route requires a signed admin JWT (previously admin endpoints were open).
- Order totals, deposits and payment amounts are computed **server-side** from DB prices.
- reCAPTCHA v3 on login, admin login, register, checkout, contact and newsletter.
- zod validation on every input, per-IP and per-account rate limits, timing-safe
  payments credited only once an admin confirms them, secrets never exposed by `GET /api/settings`,
  HTML-escaped emails, CORS restricted to the storefront origin(s).

### Web (`apps/web`)

- `core/` — HTTP client (token + captcha headers, typed errors), reCAPTCHA loader, safe storage
- `services/` — one typed module per API area
- `context/` — auth session, settings, pre-order bag, wishlist
- `components/`, `pages/` — UI; admin pages are lazy-loaded so shoppers never download chart code

## Deployment (Vercel)

One Vercel project serves everything: the API app (`apps/api`) bundles the storefront
build into `public/` (`npm run build:vercel`), so the shop and `/api/*` share one domain.

| Setting | Value |
| ------- | ----- |
| Root directory | `apps/api` |
| Framework | Next.js (build settings come from `apps/api/vercel.json`) |

Set every API variable from `apps/api/.env.example` plus `VITE_RECAPTCHA_SITE_KEY` on that
project. `VITE_API_URL` can stay empty (defaults to `/api`); set `NEXT_PUBLIC_APP_URL` to the
public URL of the site. Online payments go through Paystack: set `PAYSTACK_SECRET_KEY`
(the live `sk_live_…` key, required in production) and, in the Paystack dashboard, the webhook
URL `https://<site>/api/payments/webhook` and the callback URL `https://<site>/payment/callback`.
