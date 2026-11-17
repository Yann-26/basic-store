import { describe, expect, it, vi } from 'vitest'
import type { AdminUser, SessionUser } from '@trs/shared'
import { makeUserAdminUseCases } from '../users'
import type { UserAdminRepository } from '../../ports'
import type { AccountNotifications } from '../../notifications'

const me: SessionUser = { id: 'me', email: 'me@trs.ci', first_name: 'Me', last_name: 'X', phone: null, role: 'admin' }
const user = (over: Partial<AdminUser>): AdminUser => ({
  id: 'u2', email: 'u2@trs.ci', first_name: 'U', last_name: 'Two', phone: null, role: 'customer', is_active: true,
  two_factor_enabled: false, last_login: null, created_at: '', total_orders: 0, total_spent: 0, ...over,
})

function setup(target: AdminUser, activeAdmins = 2) {
  const repo = {
    findById: vi.fn(async () => target),
    countActiveAdmins: vi.fn(async () => activeAdmins),
    update: vi.fn(async (_id: string, patch: object) => ({ ...target, ...patch })),
    resetTwoFactor: vi.fn(async () => undefined),
  } as unknown as UserAdminRepository
  const notify = {
    welcome: vi.fn(), verifyEmail: vi.fn(), passwordReset: vi.fn(), login: vi.fn(), passwordChanged: vi.fn(), suspended: vi.fn(), reactivated: vi.fn(), roleChanged: vi.fn(), twoFactorReset: vi.fn(),
  } satisfies AccountNotifications
  return { uc: makeUserAdminUseCases({ userAdmin: repo, notify }), repo, notify }
}

describe('user administration', () => {
  it('suspends a customer and promotes one to admin', async () => {
    const { uc, repo } = setup(user({}))
    expect((await uc.update(me, 'u2', { is_active: false })).is_active).toBe(false)
    await uc.update(me, 'u2', { role: 'admin' })
    expect(repo.update).toHaveBeenLastCalledWith('u2', { role: 'admin' })
  })

  it('an admin cannot change their own role or status', async () => {
    const { uc, repo } = setup(user({ id: 'me', role: 'admin' }))
    await expect(uc.update(me, 'me', { is_active: false })).rejects.toMatchObject({ status: 400 })
    expect(repo.update).not.toHaveBeenCalled()
  })

  it('never removes the last active admin', async () => {
    const lastAdmin = user({ role: 'admin' })
    await expect(setup(lastAdmin, 1).uc.update(me, 'u2', { role: 'customer' })).rejects.toMatchObject({ status: 409 })
    await expect(setup(lastAdmin, 1).uc.update(me, 'u2', { is_active: false })).rejects.toMatchObject({ status: 409 })
    await expect(setup(lastAdmin, 2).uc.update(me, 'u2', { role: 'customer' })).resolves.toMatchObject({ role: 'customer' })
  })

  it('resets 2FA of another admin only', async () => {
    const { uc, repo } = setup(user({ role: 'admin', two_factor_enabled: true }))
    await uc.resetTwoFactor(me, 'u2')
    expect(repo.resetTwoFactor).toHaveBeenCalledWith('u2')
    await expect(setup(user({})).uc.resetTwoFactor(me, 'u2')).rejects.toMatchObject({ status: 400 })
    await expect(setup(user({ id: 'me', role: 'admin' })).uc.resetTwoFactor(me, 'me')).rejects.toMatchObject({ status: 400 })
  })

  it('emails the user about suspension, reactivation, role and 2FA changes', async () => {
    const a = setup(user({}))
    await a.uc.update(me, 'u2', { is_active: false })
    expect(a.notify.suspended).toHaveBeenCalledWith(expect.objectContaining({ email: 'u2@trs.ci' }))
    const b = setup(user({ is_active: false }))
    await b.uc.update(me, 'u2', { is_active: true })
    expect(b.notify.reactivated).toHaveBeenCalled()
    const c = setup(user({}))
    await c.uc.update(me, 'u2', { role: 'admin' })
    expect(c.notify.roleChanged).toHaveBeenCalledWith(expect.anything(), 'admin')
    const d = setup(user({ role: 'admin', two_factor_enabled: true }))
    await d.uc.resetTwoFactor(me, 'u2')
    expect(d.notify.twoFactorReset).toHaveBeenCalled()
  })

  it('no email when a refused change does nothing', async () => {
    const { uc, notify } = setup(user({ role: 'admin' }), 1)
    await expect(uc.update(me, 'u2', { is_active: false })).rejects.toThrow()
    expect(notify.suspended).not.toHaveBeenCalled()
  })

  it('404 for an unknown user', async () => {
    const { uc, repo } = setup(user({}))
    vi.mocked(repo.findById).mockResolvedValueOnce(null)
    await expect(uc.update(me, 'nope', { role: 'admin' })).rejects.toMatchObject({ status: 404 })
  })
})
