import { checkPasswordStrength, type AuthResponse, type SessionUser } from '@trs/shared'
import type { AuthTokenRepository, OneTimeTokens, OrderRepository, TokenService, UserRepository } from '../ports'
import type { AccountNotifications } from '../notifications'
import { ValidationError } from '@/domain/errors'

const HOUR = 3_600_000
const VERIFY_TTL = 48 * HOUR
const RESET_TTL = 1 * HOUR
const INVALID_LINK = 'Ce lien est invalide ou a expiré. Demandez-en un nouveau.'

export interface AccountDeps {
  users: UserRepository
  authTokens: AuthTokenRepository
  oneTimeTokens: OneTimeTokens
  tokens: TokenService
  orders: OrderRepository
  notify: AccountNotifications
}

/** Email verification, password reset and the customer area ("Mon compte"). */
export function makeAccountUseCases(d: AccountDeps) {
  async function issue(userId: string, purpose: 'verify_email' | 'reset_password', ttl: number) {
    await d.authTokens.revokeAll(userId, purpose) // only the latest link works
    const { token, hash } = d.oneTimeTokens.issue()
    await d.authTokens.create({ userId, purpose, tokenHash: hash, expiresAt: new Date(Date.now() + ttl) })
    return token
  }

  return {
    /** Token for the verification link of a new account (sent with the welcome email). */
    newVerificationToken(userId: string) {
      return issue(userId, 'verify_email', VERIFY_TTL)
    },

    async sendVerification(user: SessionUser) {
      if (user.email_verified) return { alreadyVerified: true }
      d.notify.verifyEmail(user, await issue(user.id, 'verify_email', VERIFY_TTL))
      return { sent: true }
    },

    async verifyEmail(token: string) {
      const userId = await d.authTokens.consume(d.oneTimeTokens.hash(token), 'verify_email')
      if (!userId) throw new ValidationError(INVALID_LINK)
      await d.users.markEmailVerified(userId)
      return { success: true }
    },

    /** Always answers the same way, so it can't reveal which emails have an account. */
    async requestPasswordReset(email: string) {
      const user = await d.users.findActiveByEmail(email)
      if (user) d.notify.passwordReset(user, await issue(user.id, 'reset_password', RESET_TTL))
      return { success: true }
    },

    async resetPassword(input: { token: string; password: string }) {
      const strength = checkPasswordStrength(input.password)
      if (!strength.ok) throw new ValidationError(strength.message)
      const userId = await d.authTokens.consume(d.oneTimeTokens.hash(input.token), 'reset_password')
      if (!userId) throw new ValidationError(INVALID_LINK)
      const result = await d.users.resetPassword(userId, input.password)
      if (!result.success) throw new ValidationError(result.message || INVALID_LINK)
      await d.authTokens.revokeAll(userId, 'reset_password')
      const user = await d.users.getSessionUser(userId)
      if (user) d.notify.passwordChanged(user)
      return { success: true }
    },

    /** Name and phone; returns a fresh session carrying the new details. */
    async updateProfile(user: SessionUser, input: { first_name: string; last_name: string; phone?: string | null }): Promise<AuthResponse> {
      const updated = await d.users.updateProfile(user.id, { first_name: input.first_name, last_name: input.last_name, phone: input.phone || null })
      const next: SessionUser = { ...updated, role: user.role, email_verified: user.email_verified }
      // role admin here means the current session passed 2FA (see resolveSession).
      return { user: next, ...(await d.tokens.sign(next, { mfa: user.role === 'admin' })) }
    },

    async myOrders(user: SessionUser) {
      // Older orders are matched by email only once the account proved it owns that address.
      const orders = await d.orders.listForAccount(user.id, user.email_verified ? user.email : null)
      // The shop's internal notes stay in the back-office; the customer sees the money received.
      return orders.map(({ admin_notes: _notes, payments, ...order }) => ({
        ...order,
        payments: (payments ?? [])
          // what was received, plus a Wave payment waiting for the shop's confirmation
          .filter((p) => p.status === 'success' || p.status === 'refunded' || (p.status === 'pending' && p.method === 'wave'))
          // only whether a Wave payment was declared, never the shop's notes or metadata
          .map(({ note: _note, metadata, ...p }) => ({ ...p, metadata: metadata?.declared_at ? { declared_at: metadata.declared_at } : null })),
      }))
    },
  }
}
