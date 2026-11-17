import { SOCIAL_PROVIDER_LABELS, SOCIAL_PROVIDERS, type AuthResponse, type LinkedAccounts, type SessionUser, type SocialProvider } from '@trs/shared'
import type { AuthTokenRepository, IdentityRepository, OAuthProfile, OAuthProvider, OneTimeTokens, TokenService, UserRepository } from '../ports'
import type { AccountNotifications, RequestMeta } from '../notifications'
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from '@/domain/errors'
import { brand } from '../brand'

export interface SocialDeps {
  providers: Partial<Record<SocialProvider, OAuthProvider>>
  users: UserRepository
  identities: IdentityRepository
  authTokens: AuthTokenRepository
  oneTimeTokens: OneTimeTokens
  tokens: TokenService
  notify: AccountNotifications
  pkce: () => { verifier: string; challenge: string }
  verificationToken: (userId: string) => Promise<string>
  config: { appUrl: string; callbackBase: string }
}

/** Signed into the `trs_oauth` cookie between the redirect to the provider and its callback. */
interface OAuthState extends Record<string, unknown> {
  provider: SocialProvider
  state: string
  verifier: string
  next: string
  /** Set when linking a provider from "Mon compte". */
  linkUserId?: string
}

/** A new social account that still needs an email address (TikTok, Facebook without the permission). */
interface PendingSignup extends Record<string, unknown> {
  provider: SocialProvider
  providerUserId: string
  firstName: string
  lastName: string
}

const STATE_TTL = 10 * 60 // seconds
const SIGNUP_TTL = 30 * 60
const LOGIN_CODE_TTL = 2 * 60_000 // ms
const LINK_TTL = 2 * 60_000

/**
 * Only Google can attach itself to an existing account with the same address:
 * it tells us the address is verified. For the others, a person could have put
 * someone else's address on their profile, so they must sign in with their
 * password first and link the provider from "Mon compte".
 */
const TRUSTED_FOR_EMAIL_LINKING: SocialProvider[] = ['google']

export const isSocialProvider = (v: string): v is SocialProvider => (SOCIAL_PROVIDERS as readonly string[]).includes(v)

/** Only same-site paths, so the redirect after sign-in can't be pointed at another site. */
export function safeNext(next: string | null | undefined, fallback = '/'): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') && next.length <= 300 ? next : fallback
}

export class OAuthFlowError extends Error {}

/** Sign-in and sign-up with Google, Facebook and TikTok (OAuth 2.0 authorization code flow). */
export function makeSocialAuthUseCases(d: SocialDeps) {
  const label = (p: SocialProvider) => SOCIAL_PROVIDER_LABELS[p]
  const web = (path: string) => `${d.config.appUrl.replace(/\/$/, '')}${path}`
  const callbackUrl = (p: SocialProvider) => `${d.config.callbackBase.replace(/\/$/, '')}/auth/oauth/${p}/callback`
  /** Results travel in the URL fragment: never sent to servers nor leaked through Referer. */
  const result = (params: Record<string, string>) => web(`/connexion/sociale#${new URLSearchParams(params)}`)

  function provider(id: string): OAuthProvider {
    const p = isSocialProvider(id) ? d.providers[id] : undefined
    if (!p) throw new OAuthFlowError('Cette méthode de connexion n’est pas disponible pour le moment.')
    return p
  }

  async function oneTime(userId: string, purpose: 'oauth_login' | 'oauth_link', ttl: number) {
    const { token, hash } = d.oneTimeTokens.issue()
    await d.authTokens.create({ userId, purpose, tokenHash: hash, expiresAt: new Date(Date.now() + ttl) })
    return token
  }

  async function session(user: SessionUser, meta: RequestMeta): Promise<AuthResponse> {
    const state = await d.users.getAccountState(user.id)
    // Like the password form: the back-office always goes through the admin login and 2FA.
    const sessionUser: SessionUser = { ...user, role: 'customer', email_verified: state?.emailVerified ?? false }
    d.notify.login(user, meta)
    return { user: sessionUser, ...(await d.tokens.sign(sessionUser)) }
  }

  const displayName = (p: OAuthProfile) => [p.firstName, p.lastName].filter(Boolean).join(' ') || null

  /** Finds or creates the account for a provider profile; returns where to send the browser. */
  async function signIn(p: SocialProvider, profile: OAuthProfile, next: string): Promise<string> {
    let userId = await d.identities.findUserId(p, profile.providerUserId)

    if (!userId && profile.email) {
      const existing = await d.users.findActiveByEmail(profile.email)
      if (existing) {
        if (!TRUSTED_FOR_EMAIL_LINKING.includes(p) || !profile.emailVerified) {
          throw new OAuthFlowError(
            `Un compte existe déjà avec l’adresse ${profile.email}. Connectez-vous avec votre mot de passe, puis liez ${label(p)} depuis Mon compte → Sécurité.`,
          )
        }
        await d.identities.link({ userId: existing.id, provider: p, providerUserId: profile.providerUserId, email: profile.email, displayName: displayName(profile) })
        await d.users.markEmailVerified(existing.id)
        userId = existing.id
      } else if (await d.users.emailExists(profile.email)) {
        throw new OAuthFlowError('Ce compte est suspendu. Contactez-nous pour plus d’informations.')
      } else {
        const created = await d.users.createSocial({ email: profile.email, firstName: profile.firstName || label(p), lastName: profile.lastName, emailVerified: profile.emailVerified })
        await d.identities.link({ userId: created.id, provider: p, providerUserId: profile.providerUserId, email: profile.email, displayName: displayName(profile) })
        d.notify.welcome(created, profile.emailVerified ? undefined : await d.verificationToken(created.id))
        userId = created.id
      }
    }

    if (!userId) {
      // No email from the provider: the storefront asks for one to finish the sign-up.
      const pending: PendingSignup = { provider: p, providerUserId: profile.providerUserId, firstName: profile.firstName, lastName: profile.lastName }
      return result({ signup: await d.tokens.signTicket('oauth-signup', pending, SIGNUP_TTL), provider: p, next })
    }

    const user = await d.users.getSessionUser(userId)
    if (!user) throw new OAuthFlowError('Ce compte est suspendu. Contactez-nous pour plus d’informations.')
    await d.identities.touch(p, profile.providerUserId)
    return result({ code: await oneTime(user.id, 'oauth_login', LOGIN_CODE_TTL), next })
  }

  async function link(p: SocialProvider, profile: OAuthProfile, userId: string): Promise<string> {
    const owner = await d.identities.findUserId(p, profile.providerUserId)
    if (owner && owner !== userId) throw new OAuthFlowError(`Ce compte ${label(p)} est déjà lié à un autre compte ${brand().name}.`)
    if (!owner) {
      const linked = await d.identities.link({ userId, provider: p, providerUserId: profile.providerUserId, email: profile.email, displayName: displayName(profile) })
      if (!linked) throw new OAuthFlowError(`Un autre compte ${label(p)} est déjà lié. Déliez-le d’abord.`)
    }
    return web(`/compte?tab=security&linked=${p}`)
  }

  return {
    /** Storefront page showing an error (for failures before the provider redirect). */
    failureUrl(message: string) {
      return result({ error: message })
    },

    /** Which buttons the storefront shows. */
    available(): { providers: SocialProvider[] } {
      return { providers: SOCIAL_PROVIDERS.filter((p) => d.providers[p]) }
    },

    /** Starts linking a provider to the signed-in account (single-use ticket for the redirect). */
    async linkTicket(user: SessionUser, providerId: string) {
      if (!isSocialProvider(providerId) || !d.providers[providerId]) throw new ValidationError('Cette méthode de connexion n’est pas disponible pour le moment.')
      return { ticket: await oneTime(user.id, 'oauth_link', LINK_TTL) }
    },

    /** Redirect to the provider; `cookie` binds the flow to this browser (login CSRF protection). */
    async begin(providerId: string, opts: { next?: string | null; link?: string | null }): Promise<{ url: string; cookie: string }> {
      const p = provider(providerId)
      let linkUserId: string | undefined
      if (opts.link) {
        linkUserId = (await d.authTokens.consume(d.oneTimeTokens.hash(opts.link), 'oauth_link')) ?? undefined
        if (!linkUserId) throw new OAuthFlowError('Le lien a expiré. Réessayez depuis Mon compte.')
      }
      const { verifier, challenge } = d.pkce()
      const state = d.oneTimeTokens.issue().token
      const payload: OAuthState = { provider: p.id, state, verifier, next: safeNext(opts.next), ...(linkUserId ? { linkUserId } : {}) }
      return {
        url: p.authorizeUrl({ state, codeChallenge: challenge, redirectUri: callbackUrl(p.id) }),
        cookie: await d.tokens.signTicket('oauth-state', payload, STATE_TTL),
      }
    },

    /** Provider callback → where to send the browser (the storefront page, with a code or an error). */
    async callback(providerId: string, q: { code?: string | null; state?: string | null; error?: string | null }, cookie: string | null | undefined): Promise<string> {
      try {
        const p = provider(providerId)
        const flow = cookie ? await d.tokens.verifyTicket<OAuthState>('oauth-state', cookie) : null
        if (!flow || flow.provider !== p.id || !q.state || flow.state !== q.state) {
          throw new OAuthFlowError('La connexion a expiré ou a été ouverte dans un autre navigateur. Réessayez.')
        }
        if (q.error || !q.code) throw new OAuthFlowError(`Connexion ${label(p.id)} annulée.`)
        let profile: OAuthProfile
        try {
          profile = await p.fetchProfile({ code: q.code, codeVerifier: flow.verifier, redirectUri: callbackUrl(p.id) })
        } catch (error) {
          console.error(`[oauth] ${p.id} profile`, error)
          throw new OAuthFlowError(`${label(p.id)} n’a pas pu confirmer votre identité. Réessayez.`)
        }
        if (!profile.providerUserId) throw new OAuthFlowError(`${label(p.id)} n’a pas pu confirmer votre identité. Réessayez.`)
        return flow.linkUserId ? await link(p.id, profile, flow.linkUserId) : await signIn(p.id, profile, safeNext(flow.next))
      } catch (error) {
        if (!(error instanceof OAuthFlowError)) console.error('[oauth] callback', error)
        const message = error instanceof OAuthFlowError ? error.message : 'La connexion a échoué. Réessayez dans un instant.'
        return result({ error: message })
      }
    },

    /** The storefront trades the one-time code from the callback for a session. */
    async exchange(code: string, meta: RequestMeta = {}): Promise<AuthResponse> {
      const userId = await d.authTokens.consume(d.oneTimeTokens.hash(code), 'oauth_login')
      const user = userId ? await d.users.getSessionUser(userId) : null
      if (!user) throw new UnauthorizedError('La connexion a expiré. Réessayez.')
      return session(user, meta)
    },

    /** Finishes a sign-up whose provider gave no email: the address must then be verified. */
    async completeSignup(input: { ticket: string; email: string; firstName: string; lastName: string }, meta: RequestMeta = {}): Promise<AuthResponse> {
      const pending = await d.tokens.verifyTicket<PendingSignup>('oauth-signup', input.ticket)
      if (!pending || !isSocialProvider(pending.provider)) throw new UnauthorizedError('Cette inscription a expiré. Reconnectez-vous.')
      if (await d.identities.findUserId(pending.provider, pending.providerUserId)) throw new ConflictError('Ce compte est déjà créé. Reconnectez-vous.')
      if (await d.users.emailExists(input.email)) {
        throw new ConflictError(
          `Un compte existe déjà avec cet email. Connectez-vous avec votre mot de passe, puis liez ${label(pending.provider)} depuis Mon compte → Sécurité.`,
        )
      }
      const user = await d.users.createSocial({ email: input.email, firstName: input.firstName, lastName: input.lastName, emailVerified: false })
      const linked = await d.identities.link({
        userId: user.id,
        provider: pending.provider,
        providerUserId: pending.providerUserId,
        email: null,
        displayName: [pending.firstName, pending.lastName].filter(Boolean).join(' ') || null,
      })
      if (!linked) throw new ConflictError('Ce compte est déjà créé. Reconnectez-vous.')
      d.notify.welcome(user, await d.verificationToken(user.id))
      const sessionUser: SessionUser = { ...user, email_verified: false }
      return { user: sessionUser, ...(await d.tokens.sign(sessionUser)) }
    },

    async linkedAccounts(user: SessionUser): Promise<LinkedAccounts> {
      const [identities, passwordSet] = await Promise.all([d.identities.listForUser(user.id), d.users.hasPassword(user.id)])
      return {
        passwordSet,
        providers: SOCIAL_PROVIDERS.map((p) => {
          const i = identities.find((x) => x.provider === p)
          return { provider: p, enabled: Boolean(d.providers[p]), linked: Boolean(i), email: i?.email ?? null, name: i?.displayName ?? null, linkedAt: i?.createdAt ?? null }
        }),
      }
    },

    /** Unlinks a provider, unless it is the only way left to sign in. */
    async unlink(user: SessionUser, providerId: string) {
      if (!isSocialProvider(providerId)) throw new NotFoundError('Méthode de connexion inconnue')
      const [identities, passwordSet] = await Promise.all([d.identities.listForUser(user.id), d.users.hasPassword(user.id)])
      if (!identities.some((i) => i.provider === providerId)) throw new NotFoundError(`${label(providerId)} n’est pas lié à ce compte`)
      if (!passwordSet && identities.length <= 1) {
        throw new ValidationError('C’est votre seul moyen de connexion : définissez d’abord un mot de passe (« Mot de passe oublié »).')
      }
      await d.identities.unlink(user.id, providerId)
      return this.linkedAccounts(user)
    },
  }
}
