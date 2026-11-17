import { describe, expect, it, vi } from 'vitest'
import type { Customer, Order, Product, PromoCode, SessionUser } from '@trs/shared'
import { makeOrderUseCases } from '../orders'
import { makePromoUseCases } from '../promo'
import type { CustomerRepository, Mailer, OrderRepository, ProductRepository, PromoCodeWrite, PromoRepository, SettingsRepository, UserRepository } from '../../ports'

const PRODUCT: Product = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Sacoche',
  slug: 'sacoche',
  price: 20000,
  category: 'bags',
  status: 'available',
  stock: 5,
  sizes: [],
  colors: [],
  features: [],
  is_active: true,
}

const promo = (over: Partial<PromoCode>): PromoCode => ({
  id: 'p1',
  code: 'BIENVENUE',
  kind: 'percent',
  value: 10,
  description: 'Bienvenue',
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

const referrer: SessionUser = { id: 'u-ref', email: 'ref@test.ci', first_name: 'Aïcha', last_name: 'Bamba', role: 'customer', email_verified: true } as SessionUser

function setup(codes: PromoCode[], opts: { previousOrders?: Order[]; redeemOk?: boolean; settings?: Record<string, unknown> } = {}) {
  const store = [...codes]
  const orders: Order[] = []
  const redemptions: { codeId: string; orderId: string; userId: string | null; amount: number }[] = []
  const promos = {
    findByCode: vi.fn(async (c: string) => store.find((p) => p.code === c) ?? null),
    findById: vi.fn(async (id: string) => store.find((p) => p.id === id) ?? null),
    codeExists: vi.fn(async (c: string) => store.some((p) => p.code === c)),
    create: vi.fn(async (data: PromoCodeWrite) => {
      const created = { ...data, id: `p${store.length + 1}`, uses: 0, created_at: new Date().toISOString() } as PromoCode
      store.push(created)
      return created
    }),
    update: vi.fn(async (id: string, patch: Partial<PromoCode>) => Object.assign(store.find((p) => p.id === id)!, patch)),
    delete: vi.fn(async () => {}),
    usesByUser: vi.fn(async (codeId: string, userId: string) => redemptions.filter((r) => r.codeId === codeId && r.userId === userId).length),
    redeem: vi.fn(async (r: (typeof redemptions)[number]) => {
      if (opts.redeemOk === false) return false
      redemptions.push(r)
      return true
    }),
    release: vi.fn(async () => {}),
    referralCodeOf: vi.fn(async (userId: string) => store.find((p) => p.source === 'referral' && p.owner_user_id === userId) ?? null),
    rewardsOf: vi.fn(async (userId: string) => store.filter((p) => p.source === 'reward' && p.owner_user_id === userId)),
    rewardExistsForOrder: vi.fn(async (orderId: string) => store.some((p) => p.source === 'reward' && (p as PromoCode & { source_order_id?: string }).source_order_id === orderId)),
    referredOrders: vi.fn(async () => ({ orders: 0, delivered: 0 })),
    referralStats: vi.fn(async () => []),
  } as unknown as PromoRepository
  const orderRepo = {
    create: vi.fn(async (o, items) => {
      const order = { ...o, id: `o${orders.length + 1}`, created_at: new Date().toISOString(), order_items: items } as Order
      orders.push(order)
      return order
    }),
    delete: vi.fn(async (id: string) => {
      orders.splice(orders.findIndex((o) => o.id === id), 1)
    }),
    numberExists: vi.fn(async () => false),
    addTracking: vi.fn(async () => {}),
    findById: vi.fn(async (id: string) => orders.find((o) => o.id === id) ?? null),
    update: vi.fn(async (id: string, patch: Partial<Order>) => Object.assign(orders.find((o) => o.id === id)!, patch)),
    listForAccount: vi.fn(async () => opts.previousOrders ?? []),
    reserveStock: vi.fn(async () => {}),
    releaseStock: vi.fn(async () => true),
  } as unknown as OrderRepository
  const customers: Customer[] = []
  const customerRepo = {
    findByPhone: vi.fn(async () => null),
    findByEmail: vi.fn(async () => null),
    create: vi.fn(async (c) => {
      const created = { ...c, id: 'c1' } as Customer
      customers.push(created)
      return created
    }),
  } as unknown as CustomerRepository
  const settings = { getAll: vi.fn(async () => opts.settings ?? {}), upsertMany: vi.fn() } as unknown as SettingsRepository
  const users = { getSessionUser: vi.fn(async (id: string) => (id === referrer.id ? referrer : null)) } as unknown as UserRepository
  const mailer: Mailer = { send: vi.fn(async () => true), status: () => ({ provider: 'smtp' as const, from: 'shop@test.ci', lastError: null }) }
  const config = { appUrl: 'https://shop.test' }

  const promoUseCases = makePromoUseCases({ promos, orders: orderRepo, settings, users, mailer, config })
  const orderUseCases = makeOrderUseCases({
    orders: orderRepo,
    products: { findManyByIds: vi.fn(async () => [PRODUCT]) } as unknown as ProductRepository,
    customers: customerRepo,
    settings,
    mailer,
    config,
    promo: promoUseCases,
  })
  return { promo: promoUseCases, orders: orderUseCases, store, placed: orders, redemptions, promos, mailer }
}

const account = { userId: 'u-friend', emailVerified: true, email: 'friend@test.ci' }
const checkout = (promo_code?: string) => ({
  customer: { firstName: 'Awa', lastName: 'Koné', phone: '0701020304', email: 'friend@test.ci', city: 'Abidjan', address: 'Cocody' },
  items: [{ product_id: PRODUCT.id, quantity: 2 }],
  payment_method: 'cash_on_delivery' as const,
  delivery_zone: 'pickup' as const,
  promo_code,
})

describe('promo codes at checkout', () => {
  it('takes the discount off what is paid and records the use', async () => {
    const t = setup([promo({})])
    const result = await t.orders.create(checkout(' bienvenue '), account)
    expect(result).toMatchObject({ subtotal_price: 40000, discount_amount: 4000, total_price: 36000, due_on_delivery: 36000, promo_code: 'BIENVENUE' })
    expect(t.redemptions).toEqual([{ codeId: 'p1', orderId: 'o1', userId: 'u-friend', amount: 4000 }])
  })

  it('previews the same discount', async () => {
    const t = setup([promo({ kind: 'fixed', value: 5000 })])
    expect(await t.orders.quotePromo({ promo_code: 'BIENVENUE', items: checkout().items }, account)).toMatchObject({ discount: 5000, subtotal: 40000, total: 35000 })
  })

  it('refuses an unknown or expired code without creating the order', async () => {
    const t = setup([promo({ ends_at: '2020-01-01T00:00:00Z' })])
    await expect(t.orders.create(checkout('NOPE'), account)).rejects.toMatchObject({ status: 400 })
    await expect(t.orders.create(checkout('BIENVENUE'), account)).rejects.toThrow(/expiré/)
    expect(t.placed).toHaveLength(0)
  })

  it('undoes the order when the last use was just taken', async () => {
    const t = setup([promo({})], { redeemOk: false })
    await expect(t.orders.create(checkout('BIENVENUE'), account)).rejects.toMatchObject({ status: 409 })
    expect(t.placed).toHaveLength(0)
  })

  it('gives the use back when the order is cancelled', async () => {
    const t = setup([promo({})])
    await t.orders.create(checkout('BIENVENUE'), account)
    await t.orders.update('o1', { status: 'cancelled', notify_customer: false })
    expect(t.promos.release).toHaveBeenCalledWith('o1')
  })
})

describe('referral', () => {
  it('creates one code per account, named after the person', async () => {
    const t = setup([])
    const first = await t.promo.myReferral(referrer)
    expect(first.code).toMatch(/^AICHA-[2-9A-Z]{4}$/)
    expect(first.link).toBe(`https://shop.test/?ref=${first.code}`)
    expect((await t.promo.myReferral(referrer)).code).toBe(first.code)
    expect(t.store.filter((p) => p.source === 'referral')).toHaveLength(1)
  })

  it('gives the friend the current referral discount on a first order, and remembers who referred', async () => {
    const t = setup([promo({ id: 'r1', code: 'AICHA-7KQ4', source: 'referral', owner_user_id: referrer.id, value: 10 })], { settings: { referral_friend_discount: 15 } })
    const result = await t.orders.create(checkout('AICHA-7KQ4'), account)
    expect(result.discount_amount).toBe(6000)
    expect(t.placed[0]?.referred_by_user_id).toBe(referrer.id)
  })

  it('is not for the referrer, nor for a second order', async () => {
    const code = promo({ id: 'r1', code: 'AICHA-7KQ4', source: 'referral', owner_user_id: referrer.id })
    await expect(setup([code]).orders.create(checkout('AICHA-7KQ4'), { ...account, userId: referrer.id })).rejects.toThrow(/partager/)
    const returning = setup([code], { previousOrders: [{ status: 'delivered' } as Order] })
    await expect(returning.orders.create(checkout('AICHA-7KQ4'), account)).rejects.toThrow(/première commande/)
  })

  it('rewards the referrer once, when the friend’s order is delivered', async () => {
    const t = setup([promo({ id: 'r1', code: 'AICHA-7KQ4', source: 'referral', owner_user_id: referrer.id })], { settings: { referral_reward_amount: 3000 } })
    await t.orders.create(checkout('AICHA-7KQ4'), account)
    await t.orders.update('o1', { status: 'delivered', notify_customer: false })
    const rewards = t.store.filter((p) => p.source === 'reward')
    expect(rewards).toHaveLength(1)
    expect(rewards[0]).toMatchObject({ kind: 'fixed', value: 3000, owner_user_id: referrer.id, max_uses: 1 })
    expect(t.mailer.send).toHaveBeenCalledWith(expect.objectContaining({ to: referrer.email }))
    // a second delivery event gives nothing more
    await t.promo.onOrderDelivered(t.placed[0]!)
    expect(t.store.filter((p) => p.source === 'reward')).toHaveLength(1)
  })

  it('keeps a reward for its owner', async () => {
    const t = setup([promo({ id: 'w1', code: 'MERCI-ABCDEF', source: 'reward', owner_user_id: referrer.id, kind: 'fixed', value: 5000, max_uses: 1 })])
    await expect(t.orders.create(checkout('MERCI-ABCDEF'), account)).rejects.toThrow(/autre compte/)
  })

  it('switches a used code off instead of deleting it', async () => {
    const t = setup([promo({ uses: 2 })])
    expect(await t.promo.remove('p1')).toEqual({ deleted: false, deactivated: true })
    expect(t.store[0]?.is_active).toBe(false)
  })
})
