import { describe, expect, it, vi } from 'vitest'
import type { SessionUser } from '@trs/shared'
import { makeAuthUseCases } from '../auth'
import type { AccountState, TokenService, TwoFactorCrypto, TwoFactorState, UserRepository } from '../../ports'
import type { AccountNotifications } from '../../notifications'

const admin: SessionUser = { id: 'u1', email: 'a@b.ci', first_name: 'A', last_name: 'B', phone: null, role: 'admin' }
/** What sessions carry once the account state is read (verified email). */
const adminSession = { ...admin, email_verified: true }
const ISSUED_AT = 1_800_000_000 // seconds
const GOOD = '123456'

/** Fake TOTP: "123456" is the valid code at step 10; recovery codes hash to "h:<code>". */
const twoFactor: TwoFactorCrypto = {
  newSecret: () => 'SECRET',
  otpauthUrl: (account, secret) => `otpauth://totp/x:${account}?secret=${secret}`,
  verify: (_secret, code, last) => (code === GOOD && 10 > last ? 10 : null),
  seal: (s) => `sealed(${s})`,
  open: (s) => s.replace(/^sealed\((.*)\)$/, '$1'),
  newRecoveryCodes: () => ['aaaa-bbbb', 'cccc-dddd'],
  hashRecoveryCode: (c) => `h:${c}`,
}

const activeAdmin: AccountState = { role: 'admin', isActive: true, tokensValidAfter: '1970-01-01T00:00:00Z', emailVerified: true }

function setup(opts: { state?: AccountState | null; tf?: Partial<TwoFactorState>; mfaClaim?: boolean; changeResult?: { success: boolean; message?: string } } = {}) {
  const tf: TwoFactorState = { secret: null, pendingSecret: null, enabledAt: null, lastCounter: 0, recoveryHashes: [], ...opts.tf }
  const tokens: TokenService = {
    sign: vi.fn(async () => ({ token: 'new-token', expiresAt: '2030-01-01T00:00:00Z' })),
    verify: vi.fn(async (t: string) => (t === 'valid' ? { ...admin, issuedAt: ISSUED_AT, mfa: opts.mfaClaim ?? true } : null)),
    signChallenge: vi.fn(async (id: string, purpose: string) => `challenge:${purpose}:${id}`),
    verifyChallenge: vi.fn(async (t: string) => {
      const [kind, purpose, userId] = t.split(':')
      return kind === 'challenge' && (purpose === 'setup' || purpose === 'verify') && userId ? { userId, purpose: purpose as 'setup' | 'verify' } : null
    }),
    signTicket: vi.fn(async () => 'ticket'),
    verifyTicket: vi.fn(async () => null),
  }
  const users = {
    authenticate: vi.fn(async (_e: string, p: string) => (p === 'pw' ? { user: admin } : { user: null, message: 'Identifiants incorrects' })),
    getAccountState: vi.fn(async () => (opts.state === undefined ? activeAdmin : opts.state)),
    changePassword: vi.fn(async () => opts.changeResult ?? { success: true }),
    getSessionUser: vi.fn(async () => admin),
    getTwoFactor: vi.fn(async () => tf),
    savePendingTotp: vi.fn(async () => undefined),
    enableTotp: vi.fn(async () => undefined),
    advanceTotpCounter: vi.fn(async (_id: string, counter: number) => counter > tf.lastCounter),
    consumeRecoveryCode: vi.fn(async (_id: string, hash: string) => tf.recoveryHashes.includes(hash)),
    setRecoveryCodes: vi.fn(async () => undefined),
  } as unknown as UserRepository
  const notify = {
    welcome: vi.fn(), verifyEmail: vi.fn(), passwordReset: vi.fn(), login: vi.fn(), passwordChanged: vi.fn(), suspended: vi.fn(), reactivated: vi.fn(), roleChanged: vi.fn(), twoFactorReset: vi.fn(),
  } satisfies AccountNotifications
  return { auth: makeAuthUseCases({ users, tokens, twoFactor, notify }), tokens, users, notify }
}

describe('auth.resolveSession', () => {
  it('accepts a valid token for an active account', async () => {
    expect(await setup().auth.resolveSession('valid')).toEqual(adminSession)
  })

  it('rejects a bad signature', async () => {
    expect(await setup().auth.resolveSession('forged')).toBeNull()
  })

  it('rejects tokens of deleted or disabled accounts', async () => {
    expect(await setup({ state: null }).auth.resolveSession('valid')).toBeNull()
    expect(await setup({ state: { ...activeAdmin, isActive: false } }).auth.resolveSession('valid')).toBeNull()
  })

  it('uses the role from the database, so a demoted admin loses access at once', async () => {
    expect((await setup({ state: { ...activeAdmin, role: 'customer' } }).auth.resolveSession('valid'))?.role).toBe('customer')
  })

  it('gives no admin rights to a session that did not pass 2FA', async () => {
    expect((await setup({ mfaClaim: false }).auth.resolveSession('valid'))?.role).toBe('customer')
  })

  it('rejects tokens issued before the last password change', async () => {
    const changedAfter = new Date((ISSUED_AT + 60) * 1000).toISOString()
    expect(await setup({ state: { ...activeAdmin, tokensValidAfter: changedAfter } }).auth.resolveSession('valid')).toBeNull()
    const changedBefore = new Date((ISSUED_AT - 60) * 1000).toISOString()
    expect(await setup({ state: { ...activeAdmin, tokensValidAfter: changedBefore } }).auth.resolveSession('valid')).not.toBeNull()
  })
})

describe('admin sign-in with 2FA', () => {
  it('storefront login never hands out an admin session', async () => {
    const { auth, tokens } = setup()
    const res = await auth.login({ email: 'a@b.ci', password: 'pw' })
    expect(res.user.role).toBe('customer')
    expect(tokens.sign).toHaveBeenCalledWith(expect.objectContaining({ role: 'customer' }))
  })

  it('first sign-in: password gives a setup challenge and a new (sealed) secret, no session', async () => {
    const { auth, users, tokens } = setup()
    const res = await auth.adminLogin({ email: 'a@b.ci', password: 'pw' })
    expect(res).toEqual({ status: 'mfa_setup', challenge: 'challenge:setup:u1', secret: 'SECRET', otpauthUrl: 'otpauth://totp/x:a@b.ci?secret=SECRET' })
    expect(users.savePendingTotp).toHaveBeenCalledWith('u1', 'sealed(SECRET)')
    expect(tokens.sign).not.toHaveBeenCalled()
  })

  it('setup: a valid code enables 2FA, returns recovery codes and an admin session', async () => {
    const { auth, users, tokens } = setup({ tf: { pendingSecret: 'sealed(SECRET)' } })
    const res = await auth.verifyAdminTwoFactor({ challenge: 'challenge:setup:u1', code: GOOD })
    expect(users.enableTotp).toHaveBeenCalledWith('u1', 'sealed(SECRET)', ['h:aaaa-bbbb', 'h:cccc-dddd'])
    expect(res.recoveryCodes).toEqual(['aaaa-bbbb', 'cccc-dddd'])
    expect(tokens.sign).toHaveBeenCalledWith(adminSession, { mfa: true })
  })

  it('setup: a wrong code enables nothing', async () => {
    const { auth, users } = setup({ tf: { pendingSecret: 'sealed(SECRET)' } })
    await expect(auth.verifyAdminTwoFactor({ challenge: 'challenge:setup:u1', code: '000000' })).rejects.toMatchObject({ status: 400 })
    expect(users.enableTotp).not.toHaveBeenCalled()
  })

  const enabled = { secret: 'sealed(SECRET)', enabledAt: '2026-09-28T00:00:00Z', recoveryHashes: ['h:aaaa-bbbb'] }

  it('once enabled: password only gives a verify challenge', async () => {
    const res = await setup({ tf: enabled }).auth.adminLogin({ email: 'a@b.ci', password: 'pw' })
    expect(res).toEqual({ status: 'mfa_required', challenge: 'challenge:verify:u1' })
  })

  it('verify: the authenticator code gives the admin session; a replayed code does not', async () => {
    expect((await setup({ tf: enabled }).auth.verifyAdminTwoFactor({ challenge: 'challenge:verify:u1', code: GOOD })).user).toEqual(adminSession)
    await expect(setup({ tf: { ...enabled, lastCounter: 10 } }).auth.verifyAdminTwoFactor({ challenge: 'challenge:verify:u1', code: GOOD })).rejects.toMatchObject({ status: 400 })
  })

  it('verify: a recovery code works once', async () => {
    const res = await setup({ tf: enabled }).auth.verifyAdminTwoFactor({ challenge: 'challenge:verify:u1', code: 'aaaa-bbbb' })
    expect(res.recoveryCodesLeft).toBe(0)
    await expect(setup({ tf: { ...enabled, recoveryHashes: [] } }).auth.verifyAdminTwoFactor({ challenge: 'challenge:verify:u1', code: 'aaaa-bbbb' })).rejects.toMatchObject({ status: 400 })
  })

  it('refuses expired or forged challenges, and a session token used as a challenge', async () => {
    await expect(setup({ tf: enabled }).auth.verifyAdminTwoFactor({ challenge: 'valid', code: GOOD })).rejects.toMatchObject({ status: 401 })
  })

  it('a setup challenge cannot re-enrol an admin who already has 2FA', async () => {
    await expect(setup({ tf: enabled }).auth.verifyAdminTwoFactor({ challenge: 'challenge:setup:u1', code: GOOD })).rejects.toMatchObject({ status: 409 })
  })

  it('customers cannot use the back-office sign-in', async () => {
    const { auth, users } = setup()
    vi.mocked(users.authenticate).mockResolvedValueOnce({ user: { ...admin, role: 'customer' } })
    await expect(auth.adminLogin({ email: 'a@b.ci', password: 'pw' })).rejects.toMatchObject({ status: 403 })
  })
})

describe('account emails', () => {
  it('sends a sign-in alert on every storefront login, with the request details', async () => {
    const { auth, notify } = setup()
    await auth.login({ email: 'a@b.ci', password: 'pw' }, { ip: '1.2.3.4', userAgent: 'UA' })
    expect(notify.login).toHaveBeenCalledWith(admin, { ip: '1.2.3.4', userAgent: 'UA' })
  })

  it('no alert when the password is wrong', async () => {
    const { auth, notify } = setup()
    await expect(auth.login({ email: 'a@b.ci', password: 'bad' })).rejects.toThrow()
    expect(notify.login).not.toHaveBeenCalled()
  })

  it('alerts admins only once the 2FA step succeeds', async () => {
    const enabled = { secret: 'sealed(SECRET)', enabledAt: '2026-09-28T00:00:00Z' }
    const { auth, notify } = setup({ tf: enabled })
    await auth.adminLogin({ email: 'a@b.ci', password: 'pw' })
    expect(notify.login).not.toHaveBeenCalled()
    await auth.verifyAdminTwoFactor({ challenge: 'challenge:verify:u1', code: GOOD }, { ip: '5.6.7.8' })
    expect(notify.login).toHaveBeenCalledWith(adminSession, { ip: '5.6.7.8' }, { admin: true })
  })

  it('welcomes new accounts and confirms password changes', async () => {
    const { auth, users, notify } = setup()
    ;(users as unknown as { emailExists: unknown; create: unknown }).emailExists = vi.fn(async () => false)
    ;(users as unknown as { create: unknown }).create = vi.fn(async () => ({ ...admin, role: 'customer' }))
    await auth.register({ email: 'a@b.ci', password: 'N3w-password', firstName: 'A', lastName: 'B', phone: null })
    expect(notify.welcome).toHaveBeenCalledWith(expect.objectContaining({ email: 'a@b.ci', email_verified: false }), undefined)
    await auth.changePassword(admin, { currentPassword: 'old-pass1', newPassword: 'N3w-password' })
    expect(notify.passwordChanged).toHaveBeenCalledWith(admin)
  })
})

describe('auth.changePassword', () => {
  it('returns a fresh session that keeps the admin 2FA status', async () => {
    const { auth, users, tokens } = setup()
    const res = await auth.changePassword(admin, { currentPassword: 'old-pass1', newPassword: 'N3w-password' })
    expect(users.changePassword).toHaveBeenCalledWith('u1', 'old-pass1', 'N3w-password')
    expect(tokens.sign).toHaveBeenCalledWith(admin, { mfa: true })
    expect(res.token).toBe('new-token')
  })

  it('refuses weak new passwords before touching the database', async () => {
    const { auth, users } = setup()
    await expect(auth.changePassword(admin, { currentPassword: 'old-pass1', newPassword: 'onlyletters' })).rejects.toThrow()
    expect(users.changePassword).not.toHaveBeenCalled()
  })

  it('reports a wrong current password as a validation error (not a 401 that would log out)', async () => {
    const { auth } = setup({ changeResult: { success: false, message: 'Mot de passe actuel incorrect' } })
    await expect(auth.changePassword(admin, { currentPassword: 'bad', newPassword: 'N3w-password' })).rejects.toMatchObject({ status: 400 })
  })
})
