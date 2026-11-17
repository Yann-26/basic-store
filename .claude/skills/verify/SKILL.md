---
name: verify
description: Run THE RISING STAR locally (Next API + Vite storefront) and drive changes in a browser with Playwright.
---

# Verify THE RISING STAR

## Handle
- API (Next, `apps/api`): `npx next dev -p 3001` with env from a scratch file (never commit it):
  `NEXT_PUBLIC_APP_URL=http://localhost:4185`, `OAUTH_CALLBACK_BASE=http://localhost:3001/api`,
  plus whatever the change needs (e.g. dummy `GOOGLE_CLIENT_ID/SECRET` to show the Google button).
  `AUTH_JWT_SECRET` falls back to a dev secret outside production.
- Storefront (`apps/web`): `VITE_API_URL=http://localhost:3001/api npx vite build --outDir <scratch>/dist`
  then `npx vite preview --outDir <scratch>/dist --port 4185 --strictPort`.
- Browser: Playwright from `/opt/node22/lib/node_modules/playwright/index.mjs` (Chromium preinstalled).
  Use a 390×844 viewport for mobile checks and read `document.documentElement.scrollWidth` (must be 390).

## Gotchas
- Cloud containers: egress blocks `*.supabase.co`, `*.vercel.app`, Google/Facebook/TikTok and Google Fonts.
  DB-backed routes return 500 locally; serve their data at the network layer with `page.route`
  (read real rows with the Supabase MCP `execute_sql`, read-only). Vercel previews sit behind SSO.
- Next dev compiles each route on first hit: wait for selectors, not fixed timeouts.
- Playwright doesn't route redirect hops: capture the provider URL from `context.on('request')`.
- The OAuth cookie is scoped to `/api/auth/oauth`: `context.cookies(url)` needs a URL under that path.
- `/connexion/sociale#…` reads the fragment on mount only: navigate from another page (`about:blank`) to reload it.
- Session in the browser: `localStorage.trs_session = {user, token, expiresAt}`; basket: `localStorage.trs_cart`.
- Killing servers: `ps -eo pid,args | grep "[v]ite preview"` then `kill`; `pkill -f` can kill your own shell.

## Flows worth driving
- Social sign-in: /login → "Continuer avec Google" → API `start` 302 (state, PKCE, httpOnly cookie) →
  callback with `error=access_denied` / wrong state / other browser → /connexion/sociale error page.
- Product colours: /product/<slug>, pick a colour → gallery + main photo + swatches; `?couleur=` links; add to basket.
