import { describe, expect, it, vi } from 'vitest'
import type { SessionUser, SocialProvider } from '@trs/shared'
import { makeSocialAuthUseCases, safeNext } from '../social'
import type { AuthTokenRepository, IdentityRepository, OAuthProfile, OAuthProvider, OneTimeTokens, TokenService, UserRepository } from '../../ports'
import type { AccountNotifications } from '../../notifications'

const APP = 'https://shop.ci'
const awa: SessionUser = { id: 'u1', email: 'awa@mail.ci', first_name: 'Awa', last_name: 'Koné', phone: null, role: 'customer' }

const googleProfile: OAuthProfile = { providerUserId: 'g-1', email: 'awa@mail.ci', emailVerified: true, firstName: 'Awa', lastName: 'Koné' }

function fakeProvider(id: SocialProvider, profile: () => OAuthProfile): OAuthProvider {
  return {
    id,
    authorizeUrl: ({ state, codeChallenge, redirectUri }) => `https://${id}.example/auth?state=${state}&cc=${codeChallenge}&cb=${encodeURIComponent(redirectUri)}`,
    fetchProfile: vi.fn(async ({ code }) => {
      if (code !== 'good-code') throw new Error('invalid_grant')
      return profile()
    }),
  }
}

/** Parses the storefront URL the flow redirects to (results are in the fragment). */
function landing(url: string) {
  const u = new URL(url)
  return { path: u.pathname, params: Object.fromEntries(new URLSearchParams(u.hash.slice(1))), search: Object.fromEntries(u.searchParams) }
}

function setup(opts: { profiles?: Partial<Record<SocialProvider, OAuthProfile>>; users?: SessionUser[]; inactive?: string[]; passwordSet?: boolean } = {}) {
  const accounts = [...(opts.users ?? [awa])]
  const identities: { userId: string; provider: SocialProvider; providerUserId: string; email: string | null }[] = []
  const rows: { userId: string; purpose: string; hash: string; used: boolean; expiresAt: Date }[] = []
  let n = 0

  const authTokens: AuthTokenRepository = {
    create: vi.fn(async ({ userId, purpose, tokenHash, expiresAt }) => void rows.push({ userId, purpose, hash: tokenHash, used: false, expiresAt })),
    consume: vi.fn(async (hash, purpose) => {
      const row = rows.find((r) => r.hash === hash && r.purpose === purpose && !r.used && r.expiresAt > new Date())
      if (!row) return null
      row.used = true
      return row.userId
    }),
    revokeAll: vi.fn(async () => undefined),
  }
  const oneTimeTokens: OneTimeTokens = { issue: () => ({ token: `tok${++n}`, hash: `hash:tok${n}` }), hash: (t) => `hash:${t}` }
  // Tickets are "signed" as JSON with a kind prefix; anything else fails verification.
  const tokens = {
    sign: vi.fn(async () => ({ token: 'session', expiresAt: 'x' })),
    signTicket: vi.fn(async (kind: string, data: object) => `${kind}.${JSON.stringify(data)}`),
    verifyTicket: vi.fn(async (kind: string, t: string) => (t.startsWith(`${kind}.`) ? JSON.parse(t.slice(kind.length + 1)) : null)),
  } as unknown as TokenService

  const inactive = new Set(opts.inactive ?? [])
  const users = {
    findActiveByEmail: vi.fn(async (email: string) => accounts.find((u) => u.email === email.toLowerCase() && !inactive.has(u.id)) ?? null),
    emailExists: vi.fn(async (email: string) => accounts.some((u) => u.email === email.toLowerCase())),
    getSessionUser: vi.fn(async (id: string) => (inactive.has(id) ? null : (accounts.find((u) => u.id === id) ?? null))),
    getAccountState: vi.fn(async () => ({ role: 'customer', isActive: true, tokensValidAfter: '1970-01-01T00:00:00Z', emailVerified: true })),
    markEmailVerified: vi.fn(async () => undefined),
    createSocial: vi.fn(async (d: { email: string; firstName: string; lastName: string }) => {
      const u: SessionUser = { id: `new${accounts.length}`, email: d.email, first_name: d.firstName, last_name: d.lastName, phone: null, role: 'customer' }
      accounts.push(u)
      return u
    }),
    hasPassword: vi.fn(async () => opts.passwordSet ?? true),
  } as unknown as UserRepository

  const identityRepo: IdentityRepository = {
    findUserId: vi.fn(async (p, id) => identities.find((i) => i.provider === p && i.providerUserId === id)?.userId ?? null),
    listForUser: vi.fn(async (userId) => identities.filter((i) => i.userId === userId).map((i) => ({ provider: i.provider, email: i.email, displayName: null, createdAt: 'now' }))),
    link: vi.fn(async (d) => {
      if (identities.some((i) => (i.provider === d.provider && i.providerUserId === d.providerUserId) || (i.userId === d.userId && i.provider === d.provider))) return false
      identities.push({ userId: d.userId, provider: d.provider, providerUserId: d.providerUserId, email: d.email })
      return true
    }),
    touch: vi.fn(async () => undefined),
    unlink: vi.fn(async (userId, p) => {
      const i = identities.findIndex((x) => x.userId === userId && x.provider === p)
      if (i >= 0) identities.splice(i, 1)
      return i >= 0
    }),
  }
  const notify = {
    welcome: vi.fn(), verifyEmail: vi.fn(), passwordReset: vi.fn(), login: vi.fn(), passwordChanged: vi.fn(),
    suspended: vi.fn(), reactivated: vi.fn(), roleChanged: vi.fn(), twoFactorReset: vi.fn(),
  } satisfies AccountNotifications

  const profiles = { google: googleProfile, ...opts.profiles }
  const providers = Object.fromEntries(Object.entries(profiles).map(([id, p]) => [id, fakeProvider(id as SocialProvider, () => p!)]))
  const uc = makeSocialAuthUseCases({
    providers,
    users,
    identities: identityRepo,
    authTokens,
    oneTimeTokens,
    tokens,
    notify,
    pkce: () => ({ verifier: 'verifier', challenge: 'challenge' }),
    verificationToken: async (id) => `verify-${id}`,
    config: { appUrl: APP, callbackBase: `${APP}/api` },
  })

  /** Full browser round trip: start → provider → callback. */
  async function roundTrip(p: SocialProvider, o: { next?: string; link?: string; code?: string } = {}) {
    const { url, cookie } = await uc.begin(p, { next: o.next, link: o.link })
    const state = new URL(url).searchParams.get('state')!
    return landing(await uc.callback(p, { code: o.code ?? 'good-code', state }, cookie))
  }

  return { uc, users, identities, identityRepo, notify, tokens, providers, roundTrip }
}

describe('social sign-in: start and callback', () => {
  it('redirects to the provider with state, PKCE and our callback URL', async () => {
    const { uc } = setup()
    const { url, cookie } = await uc.begin('google', { next: '/compte' })
    const q = new URL(url).searchParams
    expect(q.get('cc')).toBe('challenge')
    expect(q.get('cb')).toBe('https://shop.ci/api/auth/oauth/google/callback')
    expect(cookie).toContain(q.get('state'))
  })

  it('refuses providers that are not configured', async () => {
    const { uc } = setup()
    await expect(uc.begin('tiktok', {})).rejects.toThrow('pas disponible')
    await expect(uc.begin('myspace', {})).rejects.toThrow('pas disponible')
  })

  it('rejects a callback without the cookie of the browser that started it (login CSRF)', async () => {
    const { uc, providers } = setup()
    const { url } = await uc.begin('google', {})
    const state = new URL(url).searchParams.get('state')!
    const out = landing(await uc.callback('google', { code: 'good-code', state }, undefined))
    expect(out.params.error).toMatch(/expiré/)
    expect(providers.google!.fetchProfile).not.toHaveBeenCalled()
  })

  it('rejects a state that does not match the cookie, or a cookie for another provider', async () => {
    const { uc } = setup({ profiles: { facebook: { ...googleProfile, providerUserId: 'f-1' } } })
    const { cookie } = await uc.begin('google', {})
    expect(landing(await uc.callback('google', { code: 'good-code', state: 'forged' }, cookie)).params.error).toBeTruthy()
    const { url, cookie: fbCookie } = await uc.begin('facebook', {})
    const state = new URL(url).searchParams.get('state')!
    expect(landing(await uc.callback('google', { code: 'good-code', state }, fbCookie)).params.error).toBeTruthy()
  })

  it('reports a cancelled consent or a refused code as a readable error', async () => {
    const { uc, roundTrip } = setup()
    const { url, cookie } = await uc.begin('google', {})
    const state = new URL(url).searchParams.get('state')!
    expect(landing(await uc.callback('google', { error: 'access_denied', state }, cookie)).params.error).toMatch(/annulée/)
    expect((await roundTrip('google', { code: 'bad' })).params.error).toMatch(/confirmer/)
  })

  it('never redirects to another site after sign-in', () => {
    expect(safeNext('/compte')).toBe('/compte')
    expect(safeNext('//evil.com')).toBe('/')
    expect(safeNext('/\\evil.com')).toBe('/')
    expect(safeNext('https://evil.com')).toBe('/')
    expect(safeNext(null)).toBe('/')
  })
})

describe('social sign-in: accounts', () => {
  it('Google with a verified email links the existing account and signs in', async () => {
    const { roundTrip, identities, users, uc, notify } = setup()
    const out = await roundTrip('google', { next: '/compte' })
    expect(out.path).toBe('/connexion/sociale')
    expect(out.params.next).toBe('/compte')
    expect(identities).toEqual([{ userId: 'u1', provider: 'google', providerUserId: 'g-1', email: 'awa@mail.ci' }])
    expect(users.markEmailVerified).toHaveBeenCalledWith('u1')

    const session = await uc.exchange(out.params.code!)
    expect(session.user).toMatchObject({ id: 'u1', role: 'customer' })
    expect(notify.login).toHaveBeenCalled()
    // The code works once
    await expect(uc.exchange(out.params.code!)).rejects.toMatchObject({ status: 401 })
  })

  it('does not link an existing account when Google says the email is not verified', async () => {
    const { roundTrip, identities } = setup({ profiles: { google: { ...googleProfile, emailVerified: false } } })
    expect((await roundTrip('google')).params.error).toMatch(/existe déjà/)
    expect(identities).toHaveLength(0)
  })

  it('Facebook never takes over an existing account by email', async () => {
    const { roundTrip, identities } = setup({ profiles: { facebook: { ...googleProfile, providerUserId: 'f-1' } } })
    const out = await roundTrip('facebook')
    expect(out.params.error).toMatch(/liez Facebook depuis Mon compte/)
    expect(identities).toHaveLength(0)
  })

  it('creates an account for a new email, verified when the provider vouches for it', async () => {
    const { roundTrip, users, notify, uc } = setup({ profiles: { google: { ...googleProfile, providerUserId: 'g-2', email: 'moussa@mail.ci' } } })
    const out = await roundTrip('google')
    expect(users.createSocial).toHaveBeenCalledWith({ email: 'moussa@mail.ci', firstName: 'Awa', lastName: 'Koné', emailVerified: true })
    expect(notify.welcome).toHaveBeenCalledWith(expect.objectContaining({ email: 'moussa@mail.ci' }), undefined)
    expect((await uc.exchange(out.params.code!)).user.email).toBe('moussa@mail.ci')
  })

  it('signs in again with the same social account without creating anything', async () => {
    const { roundTrip, users } = setup({ profiles: { google: { ...googleProfile, providerUserId: 'g-2', email: 'moussa@mail.ci' } } })
    await roundTrip('google')
    const again = await roundTrip('google')
    expect(again.params.code).toBeTruthy()
    expect(users.createSocial).toHaveBeenCalledTimes(1)
  })

  it('refuses a suspended account', async () => {
    const { roundTrip } = setup({ inactive: ['u1'] })
    expect((await roundTrip('google')).params.error).toMatch(/suspendu/)
  })

  it('admins get a customer session: the back-office needs the password + 2FA', async () => {
    const { roundTrip, uc } = setup({ users: [{ ...awa, role: 'admin' }] })
    const out = await roundTrip('google')
    expect((await uc.exchange(out.params.code!)).user.role).toBe('customer')
  })
})

describe('social sign-up without an email (TikTok)', () => {
  const tiktok: OAuthProfile = { providerUserId: 't-1', email: null, emailVerified: false, firstName: 'Awa', lastName: '' }

  it('asks for an email, then creates an unverified account and sends the verification link', async () => {
    const { roundTrip, uc, users, notify, identities } = setup({ profiles: { tiktok } })
    const out = await roundTrip('tiktok')
    expect(out.params.signup).toBeTruthy()
    expect(out.params.provider).toBe('tiktok')

    const session = await uc.completeSignup({ ticket: out.params.signup!, email: 'moussa@mail.ci', firstName: 'Moussa', lastName: 'Traoré' })
    expect(session.user).toMatchObject({ email: 'moussa@mail.ci', email_verified: false })
    expect(users.createSocial).toHaveBeenCalledWith(expect.objectContaining({ emailVerified: false }))
    expect(notify.welcome).toHaveBeenCalledWith(expect.anything(), expect.stringMatching(/^verify-/))
    expect(identities[0]).toMatchObject({ provider: 'tiktok', providerUserId: 't-1' })

    // The ticket can't create a second account
    await expect(uc.completeSignup({ ticket: out.params.signup!, email: 'other@mail.ci', firstName: 'X', lastName: 'Y' })).rejects.toMatchObject({ status: 409 })
    // and the next TikTok sign-in goes straight in
    expect((await roundTrip('tiktok')).params.code).toBeTruthy()
  })

  it('won’t attach the TikTok account to someone else’s email', async () => {
    const { roundTrip, uc } = setup({ profiles: { tiktok } })
    const out = await roundTrip('tiktok')
    await expect(uc.completeSignup({ ticket: out.params.signup!, email: 'AWA@mail.ci', firstName: 'Awa', lastName: 'K' })).rejects.toMatchObject({ status: 409 })
  })

  it('rejects a forged ticket', async () => {
    const { uc } = setup({ profiles: { tiktok } })
    await expect(uc.completeSignup({ ticket: 'oauth-state.{}', email: 'x@mail.ci', firstName: 'Xx', lastName: 'Yy' })).rejects.toMatchObject({ status: 401 })
  })
})

describe('linking from Mon compte', () => {
  it('links a provider to the signed-in account with a single-use ticket', async () => {
    const { uc, roundTrip, identities } = setup({ profiles: { facebook: { ...googleProfile, providerUserId: 'f-1' } } })
    const { ticket } = await uc.linkTicket(awa, 'facebook')
    const out = await roundTrip('facebook', { link: ticket })
    expect(out.path).toBe('/compte')
    expect(out.search).toMatchObject({ tab: 'security', linked: 'facebook' })
    expect(identities).toEqual([expect.objectContaining({ userId: 'u1', provider: 'facebook' })])
    await expect(uc.begin('facebook', { link: ticket })).rejects.toThrow(/expiré/)
  })

  it('refuses a social account already linked to someone else', async () => {
    const moussa: SessionUser = { ...awa, id: 'u2', email: 'moussa@mail.ci' }
    const { uc, roundTrip, identityRepo } = setup({ users: [awa, moussa] })
    await identityRepo.link({ userId: 'u2', provider: 'google', providerUserId: 'g-1', email: null, displayName: null })
    const { ticket } = await uc.linkTicket(awa, 'google')
    expect((await roundTrip('google', { link: ticket })).params.error).toMatch(/autre compte/)
  })

  it('lists providers and unlinks, but never the only way to sign in', async () => {
    const { uc, identityRepo } = setup({ passwordSet: false })
    await identityRepo.link({ userId: 'u1', provider: 'google', providerUserId: 'g-1', email: 'awa@mail.ci', displayName: null })
    const list = await uc.linkedAccounts(awa)
    expect(list.passwordSet).toBe(false)
    expect(list.providers.find((p) => p.provider === 'google')).toMatchObject({ enabled: true, linked: true })
    expect(list.providers.find((p) => p.provider === 'tiktok')).toMatchObject({ enabled: false, linked: false })
    await expect(uc.unlink(awa, 'google')).rejects.toMatchObject({ status: 400 })
  })

  it('unlinks when the account has a password', async () => {
    const { uc, identityRepo, identities } = setup({ passwordSet: true })
    await identityRepo.link({ userId: 'u1', provider: 'google', providerUserId: 'g-1', email: null, displayName: null })
    await uc.unlink(awa, 'google')
    expect(identities).toHaveLength(0)
    await expect(uc.unlink(awa, 'google')).rejects.toMatchObject({ status: 404 })
  })
})
