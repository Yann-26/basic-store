import { checkPasswordStrength, type AdminLoginResult, type AuthResponse, type SessionUser, type TwoFactorStatus, type TwoFactorVerifyResult } from '@trs/shared'
import type { TokenService, TwoFactorCrypto, UserRepository } from '../ports'
import type { AccountNotifications, RequestMeta } from '../notifications'
import { ConflictError, ForbiddenError, UnauthorizedError, ValidationError } from '@/domain/errors'

export interface AuthDeps {
  users: UserRepository
  tokens: TokenService
  twoFactor: TwoFactorCrypto
  notify: AccountNotifications
  /** Token for the email-verification link sent with the welcome email. */
  verificationToken?: (userId: string) => Promise<string>
}

const WRONG_CODE = 'Code incorrect ou expiré'

export function makeAuthUseCases({ users, tokens, twoFactor, notify, verificationToken }: AuthDeps) {
  /** Admin rights are only granted to sessions that passed 2FA. */
  const adminSession = async (account: SessionUser, meta: RequestMeta) => {
    const user = { ...account, email_verified: (await users.getAccountState(account.id))?.emailVerified ?? false }
    notify.login(user, meta, { admin: true })
    return { user, ...(await tokens.sign(user, { mfa: true })) }
  }

  return {
    /**
     * Storefront sign-in. An admin signing in here gets a customer-level
     * session: the back-office always goes through `adminLogin` + 2FA.
     */
    async login(input: { email: string; password: string }, meta: RequestMeta = {}): Promise<AuthResponse> {
      const { user, message } = await users.authenticate(input.email, input.password)
      if (!user) throw new UnauthorizedError(message || 'Identifiants incorrects')
      notify.login(user, meta)
      const state = await users.getAccountState(user.id)
      const verified = { ...user, email_verified: state?.emailVerified ?? false }
      const sessionUser: SessionUser = user.role === 'admin' ? { ...verified, role: 'customer' } : verified
      return { user: sessionUser, ...(await tokens.sign(sessionUser)) }
    },

    /** Back-office step 1: password → 2FA challenge (and a new secret on first sign-in). */
    async adminLogin(input: { email: string; password: string }): Promise<AdminLoginResult> {
      const { user, message } = await users.authenticate(input.email, input.password)
      if (!user) throw new UnauthorizedError(message || 'Identifiants incorrects')
      if (user.role !== 'admin') throw new ForbiddenError('Accès réservé aux administrateurs')

      const state = await users.getTwoFactor(user.id)
      if (state?.enabledAt && state.secret) {
        return { status: 'mfa_required', challenge: await tokens.signChallenge(user.id, 'verify') }
      }
      const secret = twoFactor.newSecret()
      await users.savePendingTotp(user.id, twoFactor.seal(secret))
      return {
        status: 'mfa_setup',
        challenge: await tokens.signChallenge(user.id, 'setup'),
        secret,
        otpauthUrl: twoFactor.otpauthUrl(user.email, secret),
      }
    },

    /** Back-office step 2: authenticator code (or a recovery code) → admin session. */
    async verifyAdminTwoFactor(input: { challenge: string; code: string }, meta: RequestMeta = {}): Promise<TwoFactorVerifyResult> {
      const challenge = await tokens.verifyChallenge(input.challenge)
      if (!challenge) throw new UnauthorizedError('Vérification expirée, reconnectez-vous')
      const [user, state] = await Promise.all([users.getSessionUser(challenge.userId), users.getTwoFactor(challenge.userId)])
      if (!user || user.role !== 'admin' || !state) throw new ForbiddenError('Accès réservé aux administrateurs')

      if (challenge.purpose === 'setup') {
        if (state.enabledAt) throw new ConflictError('La double authentification est déjà activée, reconnectez-vous')
        if (!state.pendingSecret) throw new UnauthorizedError('Vérification expirée, reconnectez-vous')
        const counter = twoFactor.verify(twoFactor.open(state.pendingSecret), input.code, 0)
        if (counter === null) throw new ValidationError(WRONG_CODE)
        const recoveryCodes = twoFactor.newRecoveryCodes()
        await users.enableTotp(user.id, state.pendingSecret, recoveryCodes.map((c) => twoFactor.hashRecoveryCode(c)))
        await users.advanceTotpCounter(user.id, counter)
        return { ...(await adminSession(user, meta)), recoveryCodes }
      }

      if (!state.enabledAt || !state.secret) throw new UnauthorizedError('Vérification expirée, reconnectez-vous')
      const code = input.code.trim()
      if (/^\d{6}$/.test(code.replace(/\s/g, ''))) {
        const counter = twoFactor.verify(twoFactor.open(state.secret), code, state.lastCounter)
        if (counter === null || !(await users.advanceTotpCounter(user.id, counter))) throw new ValidationError(WRONG_CODE)
        return adminSession(user, meta)
      }
      // Otherwise: a one-time recovery code
      const hash = twoFactor.hashRecoveryCode(code)
      if (!(await users.consumeRecoveryCode(user.id, hash))) throw new ValidationError(WRONG_CODE)
      return { ...(await adminSession(user, meta)), recoveryCodesLeft: state.recoveryHashes.length - 1 }
    },

    async twoFactorStatus(user: SessionUser): Promise<TwoFactorStatus> {
      const state = await users.getTwoFactor(user.id)
      return { enabled: Boolean(state?.enabledAt), enabledAt: state?.enabledAt ?? null, recoveryCodesLeft: state?.recoveryHashes.length ?? 0 }
    },

    /** New recovery codes (the old ones stop working); needs a current authenticator code. */
    async regenerateRecoveryCodes(user: SessionUser, code: string): Promise<{ recoveryCodes: string[] }> {
      const state = await users.getTwoFactor(user.id)
      if (!state?.enabledAt || !state.secret) throw new ValidationError("La double authentification n'est pas activée")
      const counter = twoFactor.verify(twoFactor.open(state.secret), code, state.lastCounter)
      if (counter === null || !(await users.advanceTotpCounter(user.id, counter))) throw new ValidationError(WRONG_CODE)
      const recoveryCodes = twoFactor.newRecoveryCodes()
      await users.setRecoveryCodes(user.id, recoveryCodes.map((c) => twoFactor.hashRecoveryCode(c)))
      return { recoveryCodes }
    },

    async register(input: { email: string; password: string; firstName: string; lastName: string; phone: string | null }): Promise<AuthResponse> {
      const strength = checkPasswordStrength(input.password)
      if (!strength.ok) throw new ValidationError(strength.message)
      if (await users.emailExists(input.email)) throw new ConflictError('Cet email est déjà utilisé')
      const created = await users.create(input)
      const user: SessionUser = { ...created, email_verified: false }
      notify.welcome(user, verificationToken ? await verificationToken(user.id) : undefined)
      const session = await tokens.sign(user)
      return { user, ...session }
    },

    /**
     * Turns a bearer token into the current user, or null. Besides the signature,
     * the account is re-checked on every request: a disabled/deleted account, a
     * demoted admin or a token issued before the last password change is refused.
     * Admin rights also require a session that passed two-factor authentication.
     */
    async resolveSession(token: string): Promise<SessionUser | null> {
      const claims = await tokens.verify(token)
      if (!claims) return null
      const state = await users.getAccountState(claims.id)
      if (!state || !state.isActive) return null
      const validAfter = Math.floor(new Date(state.tokensValidAfter).getTime() / 1000)
      if (claims.issuedAt < validAfter) return null
      const { issuedAt: _issuedAt, mfa, ...user } = claims
      return { ...user, role: state.role === 'admin' && mfa ? 'admin' : 'customer', email_verified: state.emailVerified }
    },

    /** A fresh session for an already authenticated user (cookie upgrade of a legacy token). */
    async reissue(user: SessionUser): Promise<AuthResponse> {
      // `user` comes from resolveSession: role admin means this session passed 2FA.
      return { user, ...(await tokens.sign(user, { mfa: user.role === 'admin' })) }
    },

    /** Changes the password, logs out every other session and returns a fresh one. */
    async changePassword(user: SessionUser, input: { currentPassword: string; newPassword: string }): Promise<AuthResponse> {
      const strength = checkPasswordStrength(input.newPassword)
      if (!strength.ok) throw new ValidationError(strength.message)
      const result = await users.changePassword(user.id, input.currentPassword, input.newPassword)
      // Not 401: the client would treat it as an expired session and log out
      if (!result.success) throw new ValidationError(result.message || 'Mot de passe actuel incorrect')
      notify.passwordChanged(user)
      // `user` comes from resolveSession: role admin means this session passed 2FA.
      const session = await tokens.sign(user, { mfa: user.role === 'admin' })
      return { user, ...session }
    },
  }
}
