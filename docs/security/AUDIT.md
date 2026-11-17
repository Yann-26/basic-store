# THE RISING STAR — Security audit & hardening plan

_Defensive white-box audit of the `COURTLAB` monorepo and its Supabase project, performed on 2026-10-02._
_Scope: `apps/api` (Next.js 15 API), `apps/web` (React SPA), `packages/shared`, `supabase/migrations`, CI, the Supabase project configuration (read-only queries) and Vercel project settings (names only, values never decrypted)._

Rules followed during the audit: no production data deleted or modified (the only production changes are the containment steps listed in §1, which change no business data), no payment issued, no third-party system attacked, no secret printed. Proofs of concept are unit tests against in-memory fakes.

There is deliberately no overall "security score": each finding stands on its own severity.

---

## 0. Summary of what changed in this PR

| Phase | What | Status |
|---|---|---|
| 1 | Containment: bucket limits (applied), storage-policy drop + Supabase Auth sign-up disable (dashboard, see §1), production config validation, dependency fixes | Done (2 dashboard actions left to the owner) |
| 2 | HttpOnly cookie sessions with a no-logout upgrade path | Done |
| 3 | CSRF / Origin checks, strict credentialed CORS, extra headers | Done |
| 4 | Central `authorize({ actor, action, resource })` + permissions, AAL2 for back-office | Done |
| 5 | Payments: ownership, idempotency, state machine, currency check, crypto references | Done |
| 6 | Customer-record BOLA fix (checkout no longer merges by phone) | Done |
| 7 | Uploads: magic-byte sniffing, server-chosen extension, crypto names | Done |
| 8 | Settings key/value validation, request IDs, safe errors, structured logs, `admin_audit_logs` | Done |
| 9 | Database grants revoked from `anon`/`authenticated`, critical rate limits fail closed | Done |
| 10 | CI: least-privilege, SHA-pinned actions, CodeQL (gating), npm audit, secret scanning (full history) | Done |

---

## 1. Containment performed before code changes

| Item | Action | State |
|---|---|---|
| TRS-C1 storage write policies | Bucket size/type limits tightened (`settings` had none). | **Applied** 2026-10-02 |
| TRS-C1 storage write policies | `DROP POLICY` on `storage.objects` — the migration role is not the table owner (`supabase_storage_admin`), statements hang. | **Owner action**: Supabase Dashboard → Storage → Policies → delete *Admin can upload*, *Admin can update*, *Admin can delete* (and the two *Public can view* listing policies). Or run `supabase/migrations/20261006000000_storage_lockdown.sql` in the SQL editor. |
| TRS-C1 (attack path) | Block Supabase Auth sign-ups (the app does not use Supabase Auth; 0 users in `auth.users`). A trigger on `auth.users` cannot be created from this role either. | **Owner action**: Dashboard → Authentication → Sign In / Providers → disable *Allow new users to sign up* and *Anonymous sign-ins*; Email provider can be disabled entirely. |

No evidence of exploitation: `auth.users` is empty and all 63 storage objects have no `owner` (they were all written by the service role through the API).

---

## 2. Architecture

### 2.1 Current (before this PR)

```
 Browser (SPA, apps/web)                          Vercel project (single origin)
 ┌────────────────────────┐  HTTPS same-origin   ┌──────────────────────────────────────┐
 │ React 19 SPA           │ ───── /api/* ──────▶ │ Next.js route handlers (apps/api)     │
 │ JWT in localStorage ⚠  │   Authorization:     │  route() wrapper: rate limit (memory) │
 │ reCAPTCHA v3 token     │   Bearer <jwt>       │  Bearer JWT → resolveSession          │
 └─────────┬──────────────┘                      │  reCAPTCHA (skipped if no secret) ⚠   │
           │ redirect                             │  use-cases → Supabase (service role)  │
           ▼                                      └───────┬──────────────┬───────────────┘
 Paystack checkout ◀── initialize (public ⚠) ─────────────┘              │
 Paystack ── webhook (HMAC-SHA512) ──▶ /api/payments/webhook             │ service role
 Google / Facebook / TikTok OAuth ◀──▶ /api/auth/oauth/*                 ▼
 Gmail SMTP ◀── emails                                  Supabase Postgres + Storage
                                                        RLS on, anon/authenticated grants ⚠
                                                        storage write policies for any
                                                        "authenticated" Supabase user ⚠
 pg_cron ── pg_net (vault secret) ──▶ /api/cron/newsletter
```

### 2.2 Target (this PR)

```
 Browser (SPA)                                    Vercel (single origin)
 ┌────────────────────────┐                      ┌─────────────────────────────────────────────┐
 │ No token in JS storage │ ─ cookie __Host-trs_ │ middleware: strict CORS (credentials only    │
 │ HttpOnly; Secure;      │   session (Lax) ───▶ │   for allow-listed origins), headers, req-id │
 │ SameSite=Lax cookie    │                      │ route():                                     │
 └────────────────────────┘                      │  1 request id + structured log               │
                                                 │  2 rate limit (Redis; critical → fail closed)│
                                                 │  3 session: cookie (Bearer only for upgrade/ │
                                                 │    legacy clients)                           │
                                                 │  4 CSRF: Origin/Sec-Fetch-Site on unsafe     │
                                                 │    cookie-authenticated requests             │
                                                 │  5 authorize({actor, action, resource})      │
                                                 │  6 reCAPTCHA (fail closed in production)     │
                                                 │  7 zod DTOs (strict) → use-case              │
                                                 │  8 admin_audit_logs for admin mutations      │
                                                 │  9 safe errors {error, code, requestId}      │
                                                 └───────┬─────────────────────────────────────┘
                                                         │ service role (server only)
                                                         ▼
                                       Supabase: RLS on, anon/authenticated revoked on
                                       private tables, no storage write policies,
                                       payment transitions are conditional updates
```

## 3. Trust boundaries

| # | Boundary | Crossing data | Control |
|---|---|---|---|
| TB1 | Internet → Vercel edge | every request | TLS, HSTS, Vercel firewall, CORS, headers |
| TB2 | Edge → route handler | body, query, headers, cookies | rate limit, session, CSRF, authorization, zod |
| TB3 | API → Supabase | SQL via PostgREST with the service role | key server-only; RLS as defence in depth |
| TB4 | Browser → Supabase (direct) | anon key is public by design | RLS, revoked grants, no storage write policies |
| TB5 | Paystack → API webhook | payment events | HMAC-SHA512 + re-verification through the Paystack API |
| TB6 | OAuth providers → API callback | codes, profiles | state cookie, PKCE (Google), appsecret_proof (Facebook) |
| TB7 | pg_cron → API | scheduler call | Bearer secret kept in Supabase Vault, compared server-side |
| TB8 | API → SMTP / Paystack / Google | outgoing calls | secrets in Vercel env only, timeouts |
| TB9 | Admin browser → back-office | catalog, orders, users, settings | admin role + 2FA (AAL2) on every request, audit log |

## 4. Authentication and authorization model

**Identities**: `public.users` (bcrypt hashes in the database, verified through the `authenticate_user` RPC), social identities in `user_identities`. Supabase Auth is not used.

**Sessions (target)**: HS256 JWT signed with `AUTH_JWT_SECRET`, now carried in an HttpOnly cookie (`__Host-trs_session` in production). Claims: `sub`, `role`, `mfa`, `iat`, `exp`. On every request `resolveSession` re-reads the account: inactive accounts, demoted admins and tokens issued before `tokens_valid_after` are refused. TTL: customer 7 days, admin 12 hours.

**Assurance levels**: AAL1 = password or social login. AAL2 = password + TOTP or a recovery code (`mfa` claim). Back-office permissions require AAL2; an admin who signs in on the storefront gets a customer session.

**Authorization (target)**: `authorize({ actor, action, resource })` in `apps/api/src/application/authorization.ts`.

| Permission | Customer (AAL1) | Admin (AAL2) |
|---|---|---|
| `order:read`, `payment:initialize` | own orders only (`order.user_id = actor.id`) | any |
| `account:*` | self | self |
| `catalog:write`, `media:write`, `settings:write`, `newsletter:*`, `user:manage`, `order:manage`, `payment:read` | ✗ | ✓ |

Any denial throws `ForbiddenError` (403) — or `NotFoundError` for foreign objects, so ids cannot be probed.

## 5. Data flows

1. **Browse**: SPA → `GET /api/catalog/*` (public, cached 30 s – 5 min) → products/brands/exclusives (active only).
2. **Sign-up / sign-in**: SPA → `POST /api/auth/register|login` (reCAPTCHA, 5–10/min) → session cookie. Social: `/api/auth/oauth/<p>` → provider → callback → one-time code in fragment → `POST /api/auth/oauth/exchange` → cookie.
3. **Checkout**: signed-in, email-verified user → `POST /api/orders` (reCAPTCHA) → server prices, sizes, colours → order + customer record bound to the account email.
4. **Payment**: `POST /api/payments/initialize` (owner only) → Paystack checkout → `/payment/callback` → `POST /api/payments/verify` and/or webhook → conditional transition `pending → success` → order `pending → confirmed`.
5. **Tracking**: `GET /api/tracking/:number` (8-char crypto number, 30/min) → status, first name, masked phone only.
6. **Back-office**: admin login + TOTP → admin routes → audit log row per mutation.
7. **Newsletter**: admin designs → schedule → pg_cron every 5 min → `/api/cron/newsletter` (vault secret) → SMTP; unsubscribe by HMAC token.

## 6. Payment and admin flows

### Payment state machine

```
                initialize (owner)                 gateway verify OK, amount ≥ due, currency XOF
   (none) ───────────────────────▶ pending ────────────────────────────────────────────▶ success ──refund.processed──▶ refunded
                                     │  ▲                                                     
             charge.failed /          │  │ (re-initialise reuses the open checkout ≤ 30 min)
             verify failed/abandoned ▼  │
                                   failed  (terminal; a new initialise creates a new reference)
```

Every transition is a conditional `UPDATE … WHERE reference = $1 AND status IN (allowed)`; only the request that wins the transition confirms the order and adds tracking, so concurrent webhook + callback cannot double-confirm. `payments.reference` is UNIQUE.

### Admin flow

Password → `mfa_required` challenge (5 min, audience-bound JWT) → TOTP with replay counter or one-time recovery code → AAL2 session cookie → every mutating admin request is written to `admin_audit_logs` (actor, action, path, status, IP, request id; never bodies).

## 7. Storage and secret models

**Buckets** (all public-read by URL, write only through the API with the service role): `products` (images + videos), `hero` (hero + newsletter visuals), `settings` (logos, founder photo), `avatars`. Size and MIME limits are enforced at three layers: API (magic bytes), bucket configuration, Vercel body limit (4.5 MB per request on serverless functions — see TRS-L6).

No private bucket exists today; nothing private is uploaded (no invoices or IDs). A future private bucket must be non-public and served through signed URLs from the API.

**Secrets** (Vercel env, production + preview, never in the repo):

| Secret | Used by | Rotation |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | API only | Move to a Supabase *secret API key* (`sb_secret_…`), individually revocable; then disable legacy JWT keys |
| `AUTH_JWT_SECRET` | session/ticket signing, HKDF for unsubscribe tokens | rotating logs everyone out |
| `PAYSTACK_SECRET_KEY` / `PAYSTACK_WEBHOOK_SECRET` | payments | Paystack dashboard |
| `RECAPTCHA_SECRET_KEY` | captcha | Google console |
| `SMTP_PASS` | Gmail app password | revoke in Google account |
| OAuth client secrets | social sign-in | provider consoles |
| `newsletter_cron_secret` | Supabase Vault (generated in DB) | `select vault.update_secret(...)` |
| `CRON_SECRET` (optional) | alternative scheduler secret | Vercel env |
| `UPSTASH_REDIS_REST_TOKEN` | rate limits (to configure) | Upstash |

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is public by design but unused by the SPA; it can be replaced by a *publishable key* and the legacy anon key disabled once storage policies are dropped.

## 8. Threat model (STRIDE, condensed)

| Threat | Asset | Before | After |
|---|---|---|---|
| Spoofing — stolen session via XSS | customer/admin sessions | JWT readable by any script | HttpOnly cookie; CSP `script-src 'self'` |
| Spoofing — Supabase Auth account → storage writes | product media, hero | possible via public sign-up | policies dropped (owner action) + sign-up off |
| Tampering — overwrite another customer's record | customer PII, order emails | phone-based merge | account-bound records |
| Tampering — payment status regression | orders, revenue | `charge.failed` after success | conditional transitions |
| Repudiation — admin actions | catalogue, users, orders | no trail | `admin_audit_logs` |
| Information disclosure — other customers' orders | orders | via hijacked customer email | only `user_id` or verified-email records |
| Information disclosure — error details | internals | Zod issues only; 500s generic | + request ids, no stack traces |
| DoS — brute force / spam | login, OTP, checkout | per-instance memory limits | Redis, critical routes fail closed |
| DoS — payment spam on Paystack | Paystack account | unlimited initialisations on any order id | owner-only + reuse of open checkout |
| Elevation — admin without 2FA | back-office | already blocked (`mfa` claim) | unchanged + AAL2 permission check |
| CSRF — once cookies are used | all mutations | n/a (Bearer) | SameSite=Lax + Origin/Sec-Fetch-Site |

## 9. Vulnerability inventory

Severity: Critical / High / Medium / Low / Info. "Regression risk" is what the fix could break and how it is mitigated.

### TRS-C1 — Supabase Storage writable by any Supabase Auth user — **Critical**
- **File**: storage policies created outside the repo (dashboard); `supabase/migrations/20261006000000_storage_lockdown.sql`
- **Endpoint**: `https://<project>.supabase.co/storage/v1/object/{products,hero,avatars}/*`
- **Root cause**: policies `Admin can upload/update/delete` check `auth.role() = 'authenticated'`, which any Supabase Auth user has; Supabase Auth sign-up is open and reachable with the public anon key.
- **Attack scenario**: attacker signs up with the anon key → gets an `authenticated` JWT → overwrites `products/<id>/<file>.jpg` with offensive or phishing content, or deletes all product photos.
- **Impact**: storefront defacement, phishing, loss of media. No PII exposure.
- **Fix**: drop the write policies (the API uses the service role, which bypasses RLS), disable Supabase Auth sign-ups, and tighten bucket limits.
- **Implementation**: migration file (bucket limits applied); dashboard steps in §1.
- **Test**: after the dashboard step, `select count(*) from pg_policies where schemaname='storage' and tablename='objects' and cmd <> 'SELECT'` must be 0 (checklist §12).
- **Regression risk**: none for the app (uploads go through the API with the service role); verified by uploading through the back-office.

### TRS-H1 — Session token stored in `localStorage` — **High**
- **File**: `apps/web/src/context/AuthContext.tsx`, `apps/web/src/core/http.ts`
- **Endpoint**: all authenticated endpoints
- **Root cause**: the JWT is kept in `localStorage` and sent as a Bearer header.
- **Attack scenario**: any XSS (including from a compromised dependency) reads `trs_session` and exfiltrates a 7-day customer token or a 12-hour admin token usable from anywhere.
- **Impact**: account takeover; admin takeover for 12 h.
- **Fix**: HttpOnly; Secure; SameSite=Lax cookie `__Host-trs_session`; token removed from JSON responses; `POST /api/auth/session` upgrades a legacy Bearer token into the cookie once (no forced logout); `POST /api/auth/logout` clears it.
- **Implementation**: `apps/api/src/interfaces/http/session-cookie.ts`, `handler.ts`, `app/api/auth/session`, `app/api/auth/logout`; web `AuthContext.tsx`, `http.ts` (`credentials: 'include'`).
- **Test**: `handler.test.ts` — the cookie is set with HttpOnly/Secure/SameSite, the body has no token, the cookie authenticates, the legacy Bearer token is upgraded.
- **Regression risk**: dev cross-origin (5173 → 3001) needs credentialed CORS — handled for allow-listed origins; OAuth exchange now sets the cookie.

### TRS-H2 — `POST /api/payments/initialize` has no ownership check — **High**
- **File**: `apps/api/app/api/payments/initialize/route.ts`, `src/application/use-cases/payments.ts`
- **Root cause**: public route, order id from the body, client-supplied `email` and `metadata` forwarded to Paystack, a new payment row on every call.
- **Attack scenario**: anyone holding/guessing an order UUID (shared links, logs) creates unlimited Paystack transactions with an arbitrary email; floods the `payments` table; sends Paystack receipts for someone else's order to an attacker-chosen address.
- **Impact**: payment record pollution, spam on the merchant account, privacy leak (order amount to third-party email).
- **Fix**: `auth: 'user'`; `authorize(actor, 'payment:initialize', order)` (owner or admin); email = account email; client metadata ignored; reuse the open checkout (idempotency) for 30 min; limit 5/min.
- **Test**: `payments.test.ts` — foreign order → 404; owner → OK; second call → same reference; paid order → 409.
- **Regression risk**: checkout and confirmation pages already require a session (orders require `auth: 'user'`).

### TRS-H3 — Checkout overwrites another customer's record (BOLA) — **High**
- **File**: `apps/api/src/application/use-cases/orders.ts` (`findOrCreateCustomer`), `order.repository.ts` (`listForAccount`)
- **Root cause**: the customer row is chosen by the phone number typed in the form; its name/address are overwritten and the attacker's email is attached when the victim's row has none or another email is free. `listForAccount` then lists every order of any customer whose email matches the account.
- **Attack scenario**: attacker (verified account `a@x`) checks out with the victim's phone → victim's customer row gets `email=a@x` → attacker's "Mes commandes" shows the victim's past orders (items, address); future status emails go to the attacker.
- **Impact**: PII disclosure, order-history disclosure, misdirected notifications.
- **Fix**: account orders always use the account's verified email; the record is found by that email (case-insensitive); a phone that already belongs to a different customer is refused with a support message instead of being merged; `listForAccount` only matches by `user_id` or by email when the account email is verified.
- **Test**: `orders.test.ts` — victim record untouched, attacker gets a conflict error; own record updated.
- **Regression risk**: a customer who ordered earlier with the same phone but no email must contact support (admin can edit the customer); there are 0 orders today.

### TRS-M1 — Payment status can regress; double confirmation race — **Medium**
- **File**: `payments.ts` (`markPaid`, `handleWebhook`)
- **Root cause**: unconditional `update` by reference; `charge.failed` overwrites `success`; webhook and callback may both confirm.
- **Attack scenario**: Paystack sends a late `charge.failed` (or replays) → paid order shows a failed payment; concurrent webhook + verify → two tracking rows, two emails.
- **Fix**: `transition(reference, from[], patch)` conditional update returning whether it won; failed only from pending; refunded only from success; currency must be XOF; only the winner confirms the order.
- **Test**: `payments.test.ts` — failed after success ignored; concurrent markPaid confirms once; wrong currency refused.
- **Regression risk**: none on the happy path.

### TRS-M2 — Rate limits fall back to per-instance memory — **Medium**
- **File**: `src/infrastructure/security/rate-limiter.ts`
- **Root cause**: Upstash not configured; on Vercel each instance counts separately.
- **Attack scenario**: credential stuffing / OTP guessing spread across instances.
- **Fix**: routes marked `critical` (login, admin login + 2FA, register, password reset, OAuth exchange, payment initialise) fail closed (429) when Redis is configured but unreachable; a production startup warning when Redis is missing; documented env vars.
- **Owner action**: create a free Upstash Redis (Vercel Marketplace) → `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.
- **Test**: `rate-limiter.test.ts`.
- **Regression risk**: a Redis outage blocks sign-in for its duration (by design, only on critical routes).

### TRS-M3 — reCAPTCHA silently disabled when the secret is missing — **Medium**
- **File**: `recaptcha.verifier.ts`
- **Fix**: in production a missing secret fails closed; `validateProductionConfig()` lists missing critical variables at boot (`/api/health` reports `config: degraded`).
- **Regression risk**: production already has the secret.

### TRS-M4 — Uploads trust the browser MIME type and file extension — **Medium**
- **File**: `src/application/use-cases/uploads.ts`
- **Root cause**: `file.type` and the user's extension are trusted; names use `Math.random`.
- **Attack scenario**: an admin account (or a stolen admin session) uploads `x.html` declared `image/png` → stored as `.html` on the public bucket → stored XSS on the Supabase domain.
- **Fix**: detect type from magic bytes (JPEG, PNG, WebP, AVIF, MP4/MOV, WebM), reject mismatches, extension derived from the detected type, `crypto.randomUUID()` names, content-type from detection.
- **Test**: `uploads.test.ts`.
- **Regression risk**: a real image with an unusual container could be refused — the error says which formats are accepted.

### TRS-M5 — `PUT /api/admin/settings` accepts arbitrary keys and sizes — **Medium**
- **File**: `settings.ts`, `schemas.ts`
- **Fix**: keys must match `^[a-z][a-z0-9_]{1,63}$`, each value ≤ 20 KB serialized, secret-like keys still refused, audit logged.
- **Regression risk**: all current keys are snake_case (verified in the admin UI code).

### TRS-M6 — `anon` / `authenticated` keep table privileges — **Medium**
- **File**: database grants (Supabase defaults)
- **Root cause**: RLS is enabled everywhere (verified), but the roles still hold INSERT/UPDATE/DELETE/TRUNCATE privileges; a single permissive policy mistake would expose data.
- **Fix**: migration `20261007000000_security_hardening.sql` revokes all write privileges from `anon`/`authenticated` on `public` tables, and all privileges on private tables (users, customers, orders, payments, identities, newsletter, audit…). Public catalogue SELECT stays.
- **Regression risk**: the SPA never queries Supabase directly (verified: no `supabase-js` in `apps/web`).

### TRS-M7 — No audit trail for admin actions — **Medium**
- **Fix**: `admin_audit_logs` table (RLS on, service-role only) written by the route wrapper for every non-GET admin request.

### TRS-M8 — Vulnerable dependency: `nodemailer` (SMTP command injection advisories) — **Medium**
- **Fix**: `nodemailer` 7 → 10.0.13; `vitest` (dev only) 3 → 5 for the mocker path-traversal advisory; `esbuild` declared explicitly in the storefront (its minifier was only installed transitively through vitest 3). `npm audit`: 0 vulnerabilities.

### TRS-L1 — Payment reference built with `Math.random` — **Low** → `crypto.randomBytes`.
### TRS-L2 — No currency check on gateway verification — **Low** → XOF required.
### TRS-L3 — CORS reflects only allow-listed origins but has no credentials policy — **Low** → `Access-Control-Allow-Credentials` only for allow-listed origins; unknown origins get no CORS headers.
### TRS-L4 — Missing COOP/CORP headers on API responses — **Low** → `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin` on `/api`.
### TRS-L5 — 500 responses cannot be correlated — **Low** → `X-Request-Id` header and `requestId` in error bodies; JSON logs.
### TRS-L6 — Upload limits above the Vercel 4.5 MB request body limit — **Low / functional** → documented; large videos must be compressed (or uploaded with signed upload URLs in a later change).
### TRS-L7 — CI without CodeQL or secret scanning — **Low** → added. The repository is private without GitHub Advanced Security, so CodeQL results gate the job from a local SARIF file instead of code-scanning alerts, and GitHub's dependency review is unavailable (`npm audit --audit-level=high` covers known advisories). Enabling GHAS would allow both.

### TRS-I1 — `.env` committed in early history (2026-07-27 → 2026-09-25) — **Info**
Contained only `VITE_API_URL` and `VITE_PAYSTACK_PUBLIC_KEY` (a *public* key, `pk_live_…`, by design shipped to browsers). No secret key, service key or password found in the tree or the full git history (patterns: Paystack sk/pk, JWTs, Supabase `sb_secret_`, AWS, Google, GitHub, Brevo, Resend, private keys). Rotation not required; the key is unused now (server-side initialisation). A full-history `gitleaks` run (v8.30.1) reports one more hit — a placeholder anon-key *stub* in `src/services/supabase.ts` (commit `d27d44b`, a JWT header followed by an 11-character placeholder, no payload or signature) — not a credential; it is allow-listed by commit in `.gitleaks.toml`. With that, history is clean.
### TRS-I2 — Stale env vars in Vercel: `RESEND_API_KEY`, `EMAIL_FROM` pointing to the old provider — **Info** → delete `RESEND_API_KEY` and revoke it at Resend.
### TRS-I3 — Production domain is `*.vercel.app` — **Info** → a custom domain enables `__Host-` cookies to be scoped to a brand domain and HSTS preload.
### TRS-I4 — Supabase Auth enabled but unused — **Info** → see §11.

### Verified as sound (no finding)
- All `SECURITY DEFINER` functions pin `search_path` and are executable by `service_role` only.
- RLS is enabled on every `public` table; public `SELECT` policies only expose active catalogue rows.
- Order totals, sizes and colours are computed server-side; client prices are ignored.
- Paystack webhook: HMAC-SHA512 with timing-safe comparison, then re-verification through the Paystack API before anything is confirmed.
- OAuth: signed state cookie, PKCE (Google), `appsecret_proof` (Facebook), one-time exchange code delivered in the URL fragment.
- 2FA: TOTP secrets encrypted at rest, replay counter, hashed one-time recovery codes; admin rights require the `mfa` claim on every request.
- Order tracking returns first name + masked phone only; order numbers are crypto-random.
- `.env*` files are git-ignored; only examples are tracked.

## 10. Remediation, migration and test plans

**Remediation order**: containment (C1) → sessions (H1) → payments & BOLA (H2, H3, M1) → platform controls (M2–M8) → low/info.

**Migrations** (idempotent, additive, no data rewritten):
1. `20261006000000_storage_lockdown.sql` — bucket limits (applied); policy drop via dashboard.
2. `20261007000000_security_hardening.sql` — `admin_audit_logs`, revoke grants, payment helper index.

**Session migration (no forced logout)**: the API keeps accepting a valid Bearer token for one release; the new SPA finds the legacy `trs_session` in `localStorage`, calls `POST /api/auth/session` with it, receives the cookie and deletes the stored token. After 7 days (max customer TTL) every live session is a cookie: the Bearer path can then be removed (tracked as a follow-up).

**Test plan**: unit tests per finding (listed above), the authorization matrix tests (`authorization.test.ts`), handler tests for cookies/CSRF/request ids, then typecheck, lint, all tests, web build, API build, and a browser pass (sign-in, checkout up to Paystack redirect, back-office upload).

## 11. Supabase Auth evaluation

| | Custom auth (today) | Supabase Auth |
|---|---|---|
| Password storage | bcrypt in `public.users` via RPC | bcrypt in `auth.users` |
| 2FA | TOTP + recovery codes, admin AAL2 enforced per request | TOTP/phone MFA, AAL in JWT |
| Social | Google, Facebook, TikTok (TikTok is not a Supabase provider) | Google, Facebook; TikTok needs custom OIDC |
| Sessions | HttpOnly cookie (this PR) | supabase-js tokens in storage unless SSR helpers |
| Revocation | `tokens_valid_after` | refresh-token revocation |

**Recommendation**: do not migrate now. The custom implementation is reviewed, covers TikTok, and enforces AAL2 server-side. A migration would need: mapping `public.users.id` → `auth.users.id` (same UUID via the admin API), importing bcrypt hashes (`encrypted_password` accepts bcrypt), moving TOTP factors (not importable — admins re-enrol), rewriting `resolveSession`, and a dual-stack period. Revisit if the team needs passkeys or SSO.

## 12. Migration verification checklist

- [ ] `select count(*) from pg_policies where schemaname='storage' and tablename='objects' and cmd <> 'SELECT';` → **0** (after the dashboard step)
- [ ] Authentication → sign-ups disabled; `select count(*) from auth.users;` → 0
- [ ] `select id, file_size_limit, allowed_mime_types from storage.buckets;` → limits as in the migration
- [ ] `select has_table_privilege('anon','public.orders','select'), has_table_privilege('authenticated','public.users','update');` → false, false
- [ ] `select has_table_privilege('anon','public.products','select');` → true (catalogue)
- [ ] `select to_regclass('public.admin_audit_logs');` → not null; a product edit adds a row
- [ ] Sign in on the storefront → DevTools shows `__Host-trs_session` HttpOnly, no `trs_session` in localStorage
- [ ] A browser that was signed in before the deploy stays signed in after reload
- [ ] Back-office: login + TOTP, upload a JPEG and an MP4, change a setting → audit rows present
- [ ] Checkout → Paystack page opens; refresh confirmation → same Paystack reference reused
- [ ] `curl -X POST <site>/api/payments/initialize` without session → 401
- [ ] `/api/health` → `config: ok` (or the list of missing variables)
- [ ] CI green, CodeQL and secret-scan jobs present

## 13. Phases

Each phase: files, migrations, env vars, tests, rollback.

| Phase | Files | Migration | Env | Tests | Rollback |
|---|---|---|---|---|---|
| 1 Containment & config | `supabase/migrations/20261006…`, `src/config/env.ts`, `src/config/validate.ts`, `recaptcha.verifier.ts`, `app/api/health`, `package.json` | 20261006 (bucket limits) | — | `validate.test.ts` | restore previous bucket limits (values in the migration header); revert commit |
| 2 Cookie sessions | `interfaces/http/session-cookie.ts`, `handler.ts`, `app/api/auth/session`, `app/api/auth/logout`, web `AuthContext.tsx`, `http.ts` | — | — | `handler.test.ts` | revert; tokens still valid as Bearer |
| 3 CSRF / CORS / headers | `handler.ts`, `middleware.ts`, `next.config.ts` | — | `ALLOWED_ORIGINS` | `handler.test.ts` | revert |
| 4 Authorization | `application/authorization.ts`, payments/account use-cases | — | — | `authorization.test.ts` | revert |
| 5 Payments | `payments.ts`, `payment.repository.ts`, `paystack.gateway.ts`, ports | 20261007 (index) | — | `payments.test.ts` | revert (no schema change needed) |
| 6 Customer BOLA | `orders.ts`, `order.repository.ts` | — | — | `orders.test.ts` | revert |
| 7 Uploads | `uploads.ts`, `infrastructure/security/file-type.ts` | — | — | `uploads.test.ts`, `file-type.test.ts` | revert |
| 8 Settings, errors, logs, audit | `settings.ts`, `schemas.ts`, `handler.ts`, `audit.repository.ts` | 20261007 (`admin_audit_logs`) | — | `settings.test.ts`, `handler.test.ts` | revert; table can stay |
| 9 Grants & rate limits | `rate-limiter.ts`, routes (`critical`) | 20261007 (revokes) | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | `rate-limiter.test.ts` | `grant … to anon, authenticated` (statements listed at the end of the migration) |
| 10 CI | `.github/workflows/ci.yml`, `codeql.yml`, `.gitleaks.toml` | — | — | CI run | revert workflow files |
