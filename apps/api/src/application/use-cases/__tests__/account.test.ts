import { describe, expect, it, vi } from 'vitest'
import type { SessionUser } from '@trs/shared'
import { makeAccountUseCases } from '../account'
import type { AuthTokenRepository, OneTimeTokens, OrderRepository, TokenService, UserRepository } from '../../ports'
import type { AccountNotifications } from '../../notifications'

const awa: SessionUser = { id: 'u1', email: 'awa@mail.ci', first_name: 'Awa', last_name: 'K', phone: null, role: 'customer', email_verified: false }

function setup() {
  // In-memory token store with the same single-use / expiry rules as the database.
  const rows: { userId: string; purpose: string; hash: string; expiresAt: Date; used: boolean }[] = []
  const authTokens: AuthTokenRepository = {
    create: vi.fn(async ({ userId, purpose, tokenHash, expiresAt }) => void rows.push({ userId, purpose, hash: tokenHash, expiresAt, used: false })),
    consume: vi.fn(async (hash, purpose) => {
      const row = rows.find((r) => r.hash === hash && r.purpose === purpose && !r.used && r.expiresAt > new Date())
      if (!row) return null
      row.used = true
      return row.userId
    }),
    revokeAll: vi.fn(async (userId, purpose) => rows.filter((r) => r.userId === userId && r.purpose === purpose).forEach((r) => (r.used = true))),
  }
  let n = 0
  const oneTimeTokens: OneTimeTokens = { issue: () => ({ token: `tok${++n}`, hash: `hash:tok${n}` }), hash: (t) => `hash:${t}` }
  const users = {
    findActiveByEmail: vi.fn(async (email: string) => (email === awa.email ? awa : null)),
    markEmailVerified: vi.fn(async () => undefined),
    resetPassword: vi.fn(async () => ({ success: true })),
    getSessionUser: vi.fn(async () => awa),
    updateProfile: vi.fn(async (_id: string, p: object) => ({ ...awa, ...p })),
  } as unknown as UserRepository
  const notify = {
    welcome: vi.fn(), verifyEmail: vi.fn(), passwordReset: vi.fn(), login: vi.fn(), passwordChanged: vi.fn(),
    suspended: vi.fn(), reactivated: vi.fn(), roleChanged: vi.fn(), twoFactorReset: vi.fn(),
  } satisfies AccountNotifications
  const tokens = { sign: vi.fn(async () => ({ token: 't', expiresAt: 'x' })) } as unknown as TokenService
  const orders = { listForAccount: vi.fn(async () => []) } as unknown as OrderRepository
  return { uc: makeAccountUseCases({ users, authTokens, oneTimeTokens, tokens, orders, notify }), users, notify, rows, tokens, orders }
}

describe('password reset', () => {
  it('emails a link to existing accounts and says the same for unknown emails', async () => {
    const { uc, notify } = setup()
    expect(await uc.requestPasswordReset('awa@mail.ci')).toEqual({ success: true })
    expect(await uc.requestPasswordReset('nobody@mail.ci')).toEqual({ success: true })
    expect(notify.passwordReset).toHaveBeenCalledTimes(1)
    expect(notify.passwordReset).toHaveBeenCalledWith(awa, 'tok1')
  })

  it('a link works once, then the password is changed and the user told', async () => {
    const { uc, users, notify } = setup()
    await uc.requestPasswordReset('awa@mail.ci')
    await uc.resetPassword({ token: 'tok1', password: 'N3w-password' })
    expect(users.resetPassword).toHaveBeenCalledWith('u1', 'N3w-password')
    expect(notify.passwordChanged).toHaveBeenCalled()
    await expect(uc.resetPassword({ token: 'tok1', password: 'N3w-password' })).rejects.toMatchObject({ status: 400 })
  })

  it('only the latest link is valid', async () => {
    const { uc } = setup()
    await uc.requestPasswordReset('awa@mail.ci')
    await uc.requestPasswordReset('awa@mail.ci')
    await expect(uc.resetPassword({ token: 'tok1', password: 'N3w-password' })).rejects.toMatchObject({ status: 400 })
    await expect(uc.resetPassword({ token: 'tok2', password: 'N3w-password' })).resolves.toEqual({ success: true })
  })

  it('refuses expired links and weak passwords (before using the link)', async () => {
    const { uc, rows } = setup()
    await uc.requestPasswordReset('awa@mail.ci')
    await expect(uc.resetPassword({ token: 'tok1', password: 'weak' })).rejects.toMatchObject({ status: 400 })
    expect(rows[0]!.used).toBe(false)
    rows[0]!.expiresAt = new Date(Date.now() - 1000)
    await expect(uc.resetPassword({ token: 'tok1', password: 'N3w-password' })).rejects.toMatchObject({ status: 400 })
  })
})

describe('email verification', () => {
  it('sends a link, confirms the address once', async () => {
    const { uc, users, notify } = setup()
    await uc.sendVerification(awa)
    expect(notify.verifyEmail).toHaveBeenCalledWith(awa, 'tok1')
    await uc.verifyEmail('tok1')
    expect(users.markEmailVerified).toHaveBeenCalledWith('u1')
    await expect(uc.verifyEmail('tok1')).rejects.toMatchObject({ status: 400 })
  })

  it('does nothing for an already verified account', async () => {
    const { uc, notify } = setup()
    expect(await uc.sendVerification({ ...awa, email_verified: true })).toEqual({ alreadyVerified: true })
    expect(notify.verifyEmail).not.toHaveBeenCalled()
  })
})

describe('customer area', () => {
  it('updates the profile and returns a session with the new name', async () => {
    const { uc, tokens } = setup()
    const res = await uc.updateProfile(awa, { first_name: 'Aya', last_name: 'K', phone: '' })
    expect(res.user.first_name).toBe('Aya')
    expect(tokens.sign).toHaveBeenCalledWith(expect.objectContaining({ first_name: 'Aya', phone: null }), { mfa: false })
  })

  it('lists orders by account, and by email only once the email is verified', async () => {
    const { uc, orders } = setup()
    await uc.myOrders({ ...awa, email_verified: true })
    expect(orders.listForAccount).toHaveBeenCalledWith('u1', 'awa@mail.ci')
    await uc.myOrders({ ...awa, email_verified: false })
    expect(orders.listForAccount).toHaveBeenLastCalledWith('u1', null)
  })
})
