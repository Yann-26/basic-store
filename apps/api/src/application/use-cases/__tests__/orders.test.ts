import { describe, expect, it, vi } from 'vitest'
import type { Customer, Order, Product } from '@trs/shared'
import { makeOrderUseCases } from '../orders'
import { makeSettingsUseCases } from '../settings'
import type { CustomerRepository, Mailer, OrderRepository, ProductRepository, SettingsRepository, DropRepository } from '../../ports'

const product = (over: Partial<Product>): Product => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Robe Soleil',
  slug: 'robe-soleil',
  price: 20000,
  category: 'clothing',
  status: 'available',
  stock: 5,
  sizes: ['S', 'M'],
  colors: ['Or'],
  features: [],
  is_active: true,
  ...over,
})

function setup(products: Product[], settings: Record<string, unknown> = { deposit_percentage: 50 }, existing: Customer[] = [], drops?: DropRepository) {
  const orders: Order[] = []
  const customers: Customer[] = [...existing]
  const orderRepo = {
    create: vi.fn(async (o, items) => {
      const order = { ...o, id: 'o1', created_at: new Date().toISOString(), order_items: items } as Order
      orders.push(order)
      return order
    }),
    numberExists: vi.fn(async () => false),
    addTracking: vi.fn(async () => {}),
    findById: vi.fn(async (id: string) => orders.find((o) => o.id === id) ?? null),
    update: vi.fn(async (id: string, patch: Partial<Order>) => Object.assign(orders.find((o) => o.id === id)!, patch)),
  } as unknown as OrderRepository
  const customerRepo = {
    findByPhone: vi.fn(async (phone: string) => customers.find((c) => c.phone === phone) ?? null),
    findByEmail: vi.fn(async (email: string) => customers.find((c) => c.email?.toLowerCase() === email.toLowerCase()) ?? null),
    update: vi.fn(async (id: string, patch: Partial<Customer>) => Object.assign(customers.find((c) => c.id === id)!, patch)),
    create: vi.fn(async (c) => {
      const created = { ...c, id: 'c1' } as Customer
      customers.push(created)
      return created
    }),
  } as unknown as CustomerRepository
  const productRepo = { findManyByIds: vi.fn(async () => products) } as unknown as ProductRepository
  const settingsRepo = { getAll: vi.fn(async () => settings), upsertMany: vi.fn() } as unknown as SettingsRepository
  const mailer: Mailer = { send: vi.fn(async () => true), status: () => ({ provider: 'smtp' as const, from: 'shop@gmail.com', lastError: null }) }

  const useCases = makeOrderUseCases({
    orders: orderRepo,
    products: productRepo,
    customers: customerRepo,
    settings: settingsRepo,
    mailer,
    config: { appUrl: 'https://shop.test' },
    drops,
  })
  return { useCases, orders, orderRepo, mailer, settingsRepo, customers, customerRepo }
}

const customer = { firstName: 'Awa', lastName: 'Koné', phone: '0701020304', email: 'awa@test.ci', city: 'Abidjan', address: 'Cocody' }

describe('orders.create', () => {
  it('keeps the pieces of an upcoming drop for its opening, and its early access for the people on the list', async () => {
    const at = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString()
    const dropsRepo = (startsAt: string, listed: boolean, preordersOpen = false) =>
      ({
        upcoming: vi.fn(async () => (new Date(startsAt) > new Date() ? [{ id: 'd1', title: 'Drop 01', starts_at: startsAt, product_ids: [product({}).id], is_published: true, preorders_open: preordersOpen }] : [])),
        hasEarlyAccess: vi.fn(async () => listed),
      }) as unknown as DropRepository
    const order = (t: ReturnType<typeof setup>, email?: string) =>
      t.useCases.create({ customer, items: [{ product_id: product({}).id, size: 'm', quantity: 1 }], payment_method: 'paystack' }, email ? { userId: 'u1', email, emailVerified: true } : undefined)

    // two days before: nobody, not even the list
    await expect(order(setup([product({})], {}, [], dropsRepo(at(48), true)), 'awa@test.ci')).rejects.toThrow(/sort avec Drop 01 : précommandes le .*24 h plus tôt pour les inscrits/)
    // twelve hours before: the list only
    const early = dropsRepo(at(12), true)
    await expect(order(setup([product({})], {}, [], early), 'awa@test.ci')).resolves.toMatchObject({ total_price: 20000 })
    expect(early.hasEarlyAccess).toHaveBeenCalledWith('d1', 'awa@test.ci', expect.any(String))
    await expect(order(setup([product({})], {}, [], dropsRepo(at(12), false)), 'other@test.ci')).rejects.toThrow(/accès anticipé, réservé aux inscrits de Drop 01/)
    await expect(order(setup([product({})], {}, [], dropsRepo(at(12), true)))).rejects.toThrow(/accès anticipé/)
    // early access switched off: closed until the opening
    await expect(order(setup([product({})], { drop_early_access_hours: 0 }, [], dropsRepo(at(12), true)), 'awa@test.ci')).rejects.toThrow(/sort avec Drop 01/)
    // a drop taking reservations: anyone reserves now with the deposit, two days before the release
    await expect(order(setup([product({})], { deposit_percentage: 60 }, [], dropsRepo(at(48), false, true)), 'other@test.ci')).resolves.toMatchObject({ total_price: 20000, deposit_amount: 12000 })
    // once open (or without a drop), anyone
    await expect(order(setup([product({})], {}, [], dropsRepo(at(-1), false)), 'other@test.ci')).resolves.toMatchObject({ total_price: 20000 })
  })

  it('refuses a complete numbered series, and more pieces than the series has left', async () => {
    const full = setup([product({ series_size: 50, pieces_numbered: 50 })])
    await expect(full.useCases.create({ customer, items: [{ product_id: product({}).id, size: 'm', quantity: 1 }], payment_method: 'paystack' })).rejects.toThrow(/épuisé/)
    const last = setup([product({ series_size: 50, pieces_numbered: 49 })])
    await expect(last.useCases.create({ customer, items: [{ product_id: product({}).id, size: 'm', quantity: 2 }], payment_method: 'paystack' })).rejects.toThrow('Il ne reste que 1 pièce')
    await expect(last.useCases.create({ customer, items: [{ product_id: product({}).id, size: 'm', quantity: 1 }], payment_method: 'paystack' })).resolves.toMatchObject({ total_price: 20000 })
  })

  it('prices the order from the database, ignoring any client amount', async () => {
    const { useCases, orders } = setup([product({})])
    const result = await useCases.create({
      customer,
      items: [{ product_id: product({}).id, size: 'm', quantity: 2 }],
      payment_method: 'wave',
    })
    expect(result.total_price).toBe(40000)
    // the deposit set in the back-office is due now, the balance before delivery
    expect(result.deposit_amount).toBe(20000)
    expect(result.remaining_amount).toBe(20000)
    expect(result.deposit_percentage).toBe(50)
    expect(result.preorder_number).toMatch(/^SC-\d{4}-[2-9A-HJKMNP-Z]{8}$/)
    expect(orders[0]?.order_items?.[0]?.size).toBe('M')
  })

  it('requires a confirmed email and links the order to the account', async () => {
    const { useCases, orders } = setup([product({})])
    const order = { customer, items: [{ product_id: product({}).id, size: 'M', quantity: 1 }], payment_method: 'wave' }
    await expect(useCases.create(order, { userId: 'u1', emailVerified: false })).rejects.toMatchObject({ status: 403, code: 'EMAIL_NOT_VERIFIED' })
    expect(orders).toHaveLength(0)
    await useCases.create(order, { userId: 'u1', emailVerified: true })
    expect((orders[0] as unknown as { user_id: string }).user_id).toBe('u1')
  })

  it('rejects a size the product does not offer', async () => {
    const { useCases } = setup([product({})])
    await expect(
      useCases.create({ customer, items: [{ product_id: product({}).id, size: 'XXL', quantity: 1 }], payment_method: 'wave' }),
    ).rejects.toThrow(/indisponible/)
  })

  it('sells size-less accessories as one size', async () => {
    const { useCases, orders } = setup([product({ category: 'accessories', sizes: [] })])
    await useCases.create({ customer, items: [{ product_id: product({}).id, quantity: 1 }], payment_method: 'wave' })
    expect(orders[0]?.order_items?.[0]?.size).toBe('TU')
  })

  it('rejects unavailable products and oversize carts', async () => {
    const { useCases } = setup([product({ status: 'unavailable' })])
    await expect(
      useCases.create({ customer, items: [{ product_id: product({}).id, size: 'S', quantity: 1 }], payment_method: 'wave' }),
    ).rejects.toThrow(/indisponible/)

    const small = setup([product({})], { max_items_per_order: 2 })
    await expect(
      small.useCases.create({ customer, items: [{ product_id: product({}).id, size: 'S', quantity: 3 }], payment_method: 'wave' }),
    ).rejects.toThrow(/Maximum 2/)
  })

  it('refuses a piece whose preorders have closed, and accepts it before', async () => {
    const closed = setup([product({ preorder_goal: 30, preorder_deadline: new Date(Date.now() - 60_000).toISOString() })])
    await expect(
      closed.useCases.create({ customer, items: [{ product_id: product({}).id, size: 'S', quantity: 1 }], payment_method: 'wave' }),
    ).rejects.toThrow(/précommandes .* sont closes/)

    const open = setup([product({ preorder_goal: 30, preorder_deadline: new Date(Date.now() + 86_400_000).toISOString() })])
    await expect(
      open.useCases.create({ customer, items: [{ product_id: product({}).id, size: 'S', quantity: 1 }], payment_method: 'wave' }),
    ).resolves.toBeTruthy()
  })
})

describe('orders.create — customer records (BOLA)', () => {
  const victim = { id: 'victim', first_name: 'Victime', last_name: 'V', phone: '0700000001', email: null, city: 'Bouaké', address: 'Rue 1' } as unknown as Customer
  const line = { product_id: product({}).id, size: 'M', quantity: 1 }

  it("refuses a phone number that belongs to another customer instead of taking over that record", async () => {
    const { useCases, customers, customerRepo } = setup([product({})], undefined, [victim])
    await expect(
      useCases.create(
        { customer: { ...customer, phone: '0700000001', email: 'someone-else@test.ci' }, items: [line], payment_method: 'wave' },
        { userId: 'attacker', emailVerified: true, email: 'attacker@test.ci' },
      ),
    ).rejects.toMatchObject({ status: 409 })
    expect(customerRepo.update).not.toHaveBeenCalled()
    expect(customers.find((c) => c.id === 'victim')).toMatchObject({ email: null, first_name: 'Victime', address: 'Rue 1' })
  })

  it('binds the record to the account email, ignoring the email typed in the form', async () => {
    const { useCases, customers } = setup([product({})])
    await useCases.create(
      { customer: { ...customer, email: 'victim@test.ci' }, items: [line], payment_method: 'wave' },
      { userId: 'u1', emailVerified: true, email: 'me@test.ci' },
    )
    expect(customers[0]?.email).toBe('me@test.ci')
  })

  it("updates the account's own record", async () => {
    const mine = { ...victim, id: 'mine', email: 'Me@Test.ci', phone: '0700000002' } as Customer
    const { useCases, customers } = setup([product({})], undefined, [mine])
    await useCases.create(
      { customer: { ...customer, phone: '0700000002', address: 'Nouvelle adresse' }, items: [line], payment_method: 'wave' },
      { userId: 'u1', emailVerified: true, email: 'me@test.ci' },
    )
    expect(customers.find((c) => c.id === 'mine')?.address).toBe('Nouvelle adresse')
  })
})

describe('settings', () => {
  it('never exposes secrets publicly and refuses to edit them', async () => {
    const repo = { getAll: vi.fn(async () => ({ store_name: 'X', instagram_access_token: 'secret' })), upsertMany: vi.fn() }
    const settings = makeSettingsUseCases({ settings: repo })
    expect(await settings.getPublic()).toEqual({ store_name: 'X' })
    await expect(settings.update([{ key: 'paystack_secret_key', value: 'x' }])).rejects.toThrow(/sensible/)
  })
})

describe('settings schema', () => {
  it('validates every key, whatever the payload shape, and caps value sizes', async () => {
    const { settingsUpdateSchema } = await import('@/interfaces/http/schemas')
    expect(settingsUpdateSchema.parse({ store_name: 'X', founder_message: 'Bonjour' })).toHaveLength(2)
    expect(() => settingsUpdateSchema.parse({ 'store-name': 'X' })).toThrow()
    // Prototype keys are dropped, never stored
    expect(settingsUpdateSchema.parse(JSON.parse('{"__proto__": {"polluted": 1}}'))).toEqual([])
    expect(() => settingsUpdateSchema.parse([{ key: 'StoreName', value: 1 }])).toThrow()
    expect(() => settingsUpdateSchema.parse([{ key: 'hero_title', value: 'x'.repeat(30_000) }])).toThrow()
  })
})

describe('orders.update — payment follows the money', () => {
  it('delivering an order does not mark it paid, and the status cannot be set by hand', async () => {
    const { useCases, orders } = setup([product({})])
    await useCases.create({ customer, items: [{ product_id: product({}).id, size: 'M', quantity: 1 }], payment_method: 'wave' })
    Object.assign(orders[0]!, { status: 'out_for_delivery', amount_paid: 10000, payment_status: 'deposit_paid' })
    await useCases.update('o1', { status: 'delivered', payment_status: 'paid' } as never)
    expect(orders[0]).toMatchObject({ status: 'delivered', payment_status: 'deposit_paid', amount_paid: 10000 })
  })
})
