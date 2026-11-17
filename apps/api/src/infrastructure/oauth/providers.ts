import { createHmac } from 'node:crypto'
import type { SocialProvider } from '@trs/shared'
import type { OAuthProfile, OAuthProvider } from '@/application/ports'
import { env } from '@/config/env'

interface AppKeys {
  clientId: string
  clientSecret: string
}

const TIMEOUT = 10_000

async function json(res: Response, what: string): Promise<Record<string, unknown>> {
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
  if (!res.ok || !data) throw new Error(`[oauth] ${what} failed (${res.status})`)
  return data
}

function postForm(url: string, form: Record<string, string>) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(form),
    signal: AbortSignal.timeout(TIMEOUT),
  })
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/** Splits "Awa Koné" when the provider only gives a display name. */
function splitName(full: string) {
  const [first = '', ...rest] = full.trim().split(/\s+/)
  return { firstName: first, lastName: rest.join(' ') }
}

/** Google — OpenID Connect with PKCE; the address is only trusted when Google says it is verified. */
export class GoogleOAuth implements OAuthProvider {
  readonly id = 'google'
  constructor(private readonly keys: AppKeys) {}

  authorizeUrl({ state, codeChallenge, redirectUri }: { state: string; codeChallenge: string; redirectUri: string }) {
    const q = new URLSearchParams({
      client_id: this.keys.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    })
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`
  }

  async fetchProfile({ code, codeVerifier, redirectUri }: { code: string; codeVerifier: string; redirectUri: string }): Promise<OAuthProfile> {
    const token = await json(
      await postForm('https://oauth2.googleapis.com/token', {
        code,
        client_id: this.keys.clientId,
        client_secret: this.keys.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }),
      'google token',
    )
    const info = await json(
      await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${str(token.access_token)}` },
        signal: AbortSignal.timeout(TIMEOUT),
      }),
      'google userinfo',
    )
    const fallback = splitName(str(info.name))
    return {
      providerUserId: str(info.sub),
      email: str(info.email) || null,
      emailVerified: info.email_verified === true,
      firstName: str(info.given_name) || fallback.firstName,
      lastName: str(info.family_name) || fallback.lastName,
    }
  }
}

const GRAPH = 'https://graph.facebook.com/v21.0'

/** Facebook Login — the email is only shared when the user grants it. */
export class FacebookOAuth implements OAuthProvider {
  readonly id = 'facebook'
  constructor(private readonly keys: AppKeys) {}

  authorizeUrl({ state, redirectUri }: { state: string; codeChallenge: string; redirectUri: string }) {
    const q = new URLSearchParams({ client_id: this.keys.clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'public_profile,email', state })
    return `https://www.facebook.com/v21.0/dialog/oauth?${q}`
  }

  async fetchProfile({ code, redirectUri }: { code: string; codeVerifier: string; redirectUri: string }): Promise<OAuthProfile> {
    const q = new URLSearchParams({ client_id: this.keys.clientId, client_secret: this.keys.clientSecret, redirect_uri: redirectUri, code })
    const token = await json(await fetch(`${GRAPH}/oauth/access_token?${q}`, { signal: AbortSignal.timeout(TIMEOUT) }), 'facebook token')
    const accessToken = str(token.access_token)
    // appsecret_proof: the token alone can't be replayed against our app from elsewhere.
    const proof = createHmac('sha256', this.keys.clientSecret).update(accessToken).digest('hex')
    const me = await json(
      await fetch(`${GRAPH}/me?${new URLSearchParams({ fields: 'id,first_name,last_name,name,email', access_token: accessToken, appsecret_proof: proof })}`, {
        signal: AbortSignal.timeout(TIMEOUT),
      }),
      'facebook profile',
    )
    const fallback = splitName(str(me.name))
    return {
      providerUserId: str(me.id),
      email: str(me.email) || null,
      // Facebook only returns confirmed addresses, but we don't let it take over existing accounts (see social.ts).
      emailVerified: Boolean(str(me.email)),
      firstName: str(me.first_name) || fallback.firstName,
      lastName: str(me.last_name) || fallback.lastName,
    }
  }
}

/** TikTok Login Kit (web) — gives a display name but never an email address. */
export class TikTokOAuth implements OAuthProvider {
  readonly id = 'tiktok'
  constructor(private readonly keys: AppKeys) {}

  authorizeUrl({ state, redirectUri }: { state: string; codeChallenge: string; redirectUri: string }) {
    const q = new URLSearchParams({ client_key: this.keys.clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'user.info.basic', state })
    return `https://www.tiktok.com/v2/auth/authorize/?${q}`
  }

  async fetchProfile({ code, redirectUri }: { code: string; codeVerifier: string; redirectUri: string }): Promise<OAuthProfile> {
    const token = await json(
      await postForm('https://open.tiktokapis.com/v2/oauth/token/', {
        client_key: this.keys.clientId,
        client_secret: this.keys.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
      'tiktok token',
    )
    if (token.error) throw new Error(`[oauth] tiktok token refused: ${str(token.error)}`)
    const res = await json(
      await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name', {
        headers: { Authorization: `Bearer ${str(token.access_token)}` },
        signal: AbortSignal.timeout(TIMEOUT),
      }),
      'tiktok user',
    )
    const user = ((res.data as Record<string, unknown> | undefined)?.user ?? {}) as Record<string, unknown>
    const name = splitName(str(user.display_name))
    return { providerUserId: str(user.open_id) || str(token.open_id), email: null, emailVerified: false, ...name }
  }
}

/** The providers whose keys are configured. */
export function configuredProviders(): Partial<Record<SocialProvider, OAuthProvider>> {
  const keys = (k: { clientId?: string; clientSecret?: string }): AppKeys | null => (k.clientId && k.clientSecret ? { clientId: k.clientId, clientSecret: k.clientSecret } : null)
  const out: Partial<Record<SocialProvider, OAuthProvider>> = {}
  const g = keys(env.oauth.google)
  const f = keys(env.oauth.facebook)
  const t = keys(env.oauth.tiktok)
  if (g) out.google = new GoogleOAuth(g)
  if (f) out.facebook = new FacebookOAuth(f)
  if (t) out.tiktok = new TikTokOAuth(t)
  return out
}
