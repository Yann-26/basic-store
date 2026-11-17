import { describe, expect, it } from 'vitest'
import type { SessionUser } from '@trs/shared'
import { actorOf, authorize, can, type Action } from '../authorization'

const base: SessionUser = { id: 'u1', email: 'a@b.ci', first_name: 'A', last_name: 'B', role: 'customer', email_verified: true }
const customer = actorOf(base)!
const otherCustomer = actorOf({ ...base, id: 'u2' })!
const admin = actorOf({ ...base, id: 'adm', role: 'admin' })!
const own = { user_id: 'u1' }

const ADMIN_ACTIONS: Action[] = ['admin:access', 'order:manage', 'payment:read', 'catalog:write', 'media:write', 'settings:write', 'newsletter:manage', 'customer:read', 'user:manage']

describe('authorization matrix', () => {
  it('anonymous visitors can do nothing protected (401)', () => {
    expect(() => authorize({ actor: null, action: 'order:read', resource: own })).toThrow(expect.objectContaining({ status: 401 }))
    expect(() => authorize({ actor: null, action: 'admin:access' })).toThrow(expect.objectContaining({ status: 401 }))
  })

  it.each(ADMIN_ACTIONS)('customers are refused %s (403)', (action) => {
    expect(() => authorize({ actor: customer, action })).toThrow(expect.objectContaining({ status: 403 }))
  })

  it.each(ADMIN_ACTIONS)('admins (AAL2) may %s', (action) => {
    expect(can(admin, action)).toBe(true)
  })

  it('an admin role without 2FA (AAL1) gets no back-office permission', () => {
    expect(can({ ...admin, aal: 1 }, 'catalog:write')).toBe(false)
    expect(can({ ...admin, aal: 1 }, 'order:read', { user_id: 'someone' })).toBe(false)
  })

  it('customers reach their own orders only; others get 404, not 403', () => {
    expect(can(customer, 'order:read', own)).toBe(true)
    expect(can(customer, 'payment:initialize', own)).toBe(true)
    expect(() => authorize({ actor: otherCustomer, action: 'payment:initialize', resource: own })).toThrow(expect.objectContaining({ status: 404 }))
    expect(() => authorize({ actor: customer, action: 'order:read', resource: { user_id: null } })).toThrow(expect.objectContaining({ status: 404 }))
  })

  it('admins reach any order', () => {
    expect(can(admin, 'order:read', { user_id: 'someone' })).toBe(true)
    expect(can(admin, 'payment:initialize', { user_id: null })).toBe(true)
  })
})
