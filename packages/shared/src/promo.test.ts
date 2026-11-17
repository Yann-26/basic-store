import { describe, expect, it } from 'vitest'
import { normalizePromoCode, promoDiscount, promoProblem, referralSettings, type PromoCode } from './promo'

const code = (over: Partial<PromoCode> = {}): PromoCode => ({
  id: 'c1',
  code: 'BIENVENUE',
  kind: 'percent',
  value: 10,
  description: '',
  min_order: 0,
  max_uses: null,
  per_account_limit: 1,
  starts_at: null,
  ends_at: null,
  is_active: true,
  source: 'manual',
  owner_user_id: null,
  first_order_only: false,
  uses: 0,
  created_at: '2026-01-01T00:00:00Z',
  ...over,
})

describe('promoDiscount', () => {
  it('takes a percentage, rounded', () => {
    expect(promoDiscount({ kind: 'percent', value: 10 }, 25_005)).toBe(2_501)
  })
  it('never takes more than the basket', () => {
    expect(promoDiscount({ kind: 'fixed', value: 50_000 }, 30_000)).toBe(30_000)
    expect(promoDiscount({ kind: 'percent', value: 150 }, 30_000)).toBe(30_000)
  })
  it('is zero on an empty basket', () => {
    expect(promoDiscount({ kind: 'fixed', value: 5_000 }, 0)).toBe(0)
  })
})

describe('promoProblem', () => {
  const now = new Date('2026-06-01T12:00:00Z')
  it('accepts a valid code', () => {
    expect(promoProblem(code(), { subtotal: 10_000, now })).toBeNull()
  })
  it('refuses inactive, early, expired and exhausted codes', () => {
    expect(promoProblem(code({ is_active: false }), { subtotal: 10_000, now })).toMatch(/actif/)
    expect(promoProblem(code({ starts_at: '2026-07-01T00:00:00Z' }), { subtotal: 10_000, now })).toMatch(/pas encore/)
    expect(promoProblem(code({ ends_at: '2026-05-01T00:00:00Z' }), { subtotal: 10_000, now })).toMatch(/expiré/)
    expect(promoProblem(code({ max_uses: 3, uses: 3 }), { subtotal: 10_000, now })).toMatch(/nombre de fois/)
  })
  it('checks the minimum basket', () => {
    expect(promoProblem(code({ min_order: 20_000 }), { subtotal: 10_000, now })).toMatch(/à partir de/)
  })
  it('keeps a referral code for friends, on a first order', () => {
    const ref = code({ source: 'referral', owner_user_id: 'u1' })
    expect(promoProblem(ref, { subtotal: 10_000, now, userId: 'u1' })).toMatch(/partager/)
    expect(promoProblem(ref, { subtotal: 10_000, now, userId: 'u2', previousOrders: 1 })).toMatch(/première commande/)
    expect(promoProblem(ref, { subtotal: 10_000, now, userId: 'u2', previousOrders: 0 })).toBeNull()
  })
  it('keeps a reward for its owner', () => {
    const reward = code({ source: 'reward', owner_user_id: 'u1', kind: 'fixed', value: 5_000 })
    expect(promoProblem(reward, { subtotal: 10_000, now, userId: 'u2' })).toMatch(/autre compte/)
    expect(promoProblem(reward, { subtotal: 10_000, now, userId: 'u1' })).toBeNull()
  })
  it('limits uses per account', () => {
    expect(promoProblem(code({ per_account_limit: 1 }), { subtotal: 10_000, now, usesByUser: 1 })).toMatch(/déjà utilisé/)
  })
})

describe('referral settings and codes', () => {
  it('reads the settings with defaults and bounds', () => {
    expect(referralSettings({})).toEqual({ enabled: true, friendPercent: 10, rewardAmount: 5000 })
    expect(referralSettings({ referral_enabled: 'false', referral_friend_discount: 90, referral_reward_amount: '2500' })).toEqual({
      enabled: false,
      friendPercent: 50,
      rewardAmount: 2500,
    })
  })
  it('normalizes typed codes', () => {
    expect(normalizePromoCode('  bien venue ')).toBe('BIENVENUE')
  })
})
