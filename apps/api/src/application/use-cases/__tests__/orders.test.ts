import { describe, expect, it, vi } from 'vitest'
import type { Customer, Order, Product } from '@trs/shared'
import { makeOrderUseCases } from '../orders'
import { makeSettingsUseCases } from '../settings'
import type { CustomerRepository, Mailer, OrderRepository, ProductRepository, SettingsRepository } from '../../ports'
import { OutOfStockError } from '@/domain/errors'

const product = (over: Partial<Product>): Product => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Robe Soleil',
  slug: 'robe-soleil',
  price: 20000,
  category: 'clothing',
  status: 'available',
  stock: 10,
  sizes: ['S', 'M'],
  size_stock: { S: 5, M: 5 },
  colors: ['Or'],
  features: [],
  is_active: true,
  ...over,
})

function setup(products: Product[], settings: Record<string, unknown> = { delivery_fee_abidjan: 1000, delivery_fee_interior: 2500 }, existing: Customer[] = [], reserve?: () => Promise<void>) {
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
    delete: vi.fn(async (id: string) => void orders.splice(orders.findIndex((o) => o.id === id), 1)),
    reserveStock: vi.fn(reserve ?? (async () => {})),
    releaseStock: vi.fn(async () => true),
    listUnpaidOnline: vi.fn(async () => orders.filter((o) => o.status === 'pending' && o.payment_method === 'online' && !o.amount_paid)),
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
  })
  return { useCases, orders, orderRepo, mailer, settingsRepo, customers, customerRepo }
}

const customer = { firstName: 'Awa', lastName: 'Koné', phone: '0701020304', email: 'awa@test.ci', city: 'Abidjan', address: 'Cocody' }

describe('orders.create', () => {
  it('checks the stock of each size before writing the order', async () => {
    const t = setup([product({ size_stock: { S: 0, M: 1 } })])
    await expect(t.useCases.create({ customer, items: [{ product_id: product({}).id, size: 's', quantity: 1 }], payment_method: 'cash_on_delivery', delivery_zone: 'abidjan' })).rejects.toThrow(/rupture de stock/)
    await expect(t.useCases.create({ customer, items: [{ product_id: product({}).id, size: 'm', quantity: 2 }], payment_method: 'cash_on_delivery', delivery_zone: 'abidjan' })).rejects.toThrow('Il ne reste que 1 pièce')
    // two lines of the same size count together
    await expect(
      t.useCases.create({ customer, items: [{ product_id: product({}).id, size: 'm', quantity: 1 }, { product_id: product({}).id, size: 'M', color: 'Or', quantity: 1 }], payment_method: 'cash_on_delivery', delivery_zone: 'abidjan' }),
    ).rejects.toBeInstanceOf(OutOfStockError)
    expect(t.orders).toHaveLength(0)
    await expect(t.useCases.create({ customer, items: [{ product_id: product({}).id, size: 'm', quantity: 1 }], payment_method: 'cash_on_delivery', delivery_zone: 'abidjan' })).resolves.toBeTruthy()
    expect(t.orderRepo.reserveStock).toHaveBeenCalledWith('o1')
  })

  it('undoes the order when the database finds the stock gone meanwhile', async () => {
    const t = setup([product({})], undefined, [], async () => {
      throw new OutOfStockError('Robe Soleil', 'M', 0)
    })
    await expect(t.useCases.create({ customer, items: [{ product_id: product({}).id, size: 'm', quantity: 1 }], payment_method: 'online', delivery_zone: 'abidjan' })).rejects.toMatchObject({ code: 'OUT_OF_STOCK' })
    expect(t.orderRepo.delete).toHaveBeenCalledWith('o1')
    expect(t.orders).toHaveLength(0)
  })

  it('charges delivery by zone; online orders are paid in full now, others on delivery', async () => {
    const cod = setup([product({})])
    await expect(cod.useCases.create({ customer, items: [{ product_id: product({}).id, size: 'm', quantity: 1 }], payment_method: 'cash_on_delivery', delivery_zone: 'interior' })).resolves.toMatchObject({
      subtotal_price: 20000,
      delivery_fee: 2500,
      total_price: 22500,
      due_now: 0,
      due_on_delivery: 22500,
    })
    expect(cod.orders[0]).toMatchObject({ deposit_amount: 0, remaining_amount: 22500, payment_method: 'cash_on_delivery', delivery_zone: 'interior', delivery_fee: 2500 })

    const online = setup([product({})])
    await expect(online.useCases.create({ customer: { ...customer, address: '' }, items: [{ product_id: product({}).id, size: 'm', quantity: 1 }], payment_method: 'online', delivery_zone: 'pickup' })).resolves.toMatchObject({
      delivery_fee: 0,
      total_price: 20000,
      due_now: 20000,
      due_on_delivery: 0,
    })
    expect(online.orders[0]).toMatchObject({ deposit_amount: 20000, remaining_amount: 0, delivery_address: 'Retrait en boutique' })

    const off = setup([product({})], { online_payment_enabled: false })
    await expect(off.useCases.create({ customer, items: [{ product_id: product({}).id, size: 'm', quantity: 1 }], payment_method: 'online', delivery_zone: 'abidjan' })).rejects.toThrow(/indisponible/)
  })

  it('prices the order from the database, ignoring any client amount', async () => {
    const { useCases, orders } = setup([product({})])
    const result = await useCases.create({
      customer,
      items: [{ product_id: product({}).id, size: 'm', quantity: 2 }],
      payment_method: 'cash_on_delivery',
      delivery_zone: 'abidjan',
    })
    expect(result.subtotal_price).toBe(40000)
    expect(result.total_price).toBe(41000)
    expect(result.preorder_number).toMatch(/^BS-\d{4}-[2-9A-HJKMNP-Z]{8}$/)
    expect(orders[0]?.order_items?.[0]?.size).toBe('M')
  })

  it('requires a confirmed email and links the order to the account', async () => {
    const { useCases, orders } = setup([product({})])
    const order = { customer, items: [{ product_id: product({}).id, size: 'M', quantity: 1 }], payment_method: 'cash_on_delivery' as const, delivery_zone: 'abidjan' as const }
    await expect(useCases.create(order, { userId: 'u1', emailVerified: false })).rejects.toMatchObject({ status: 403, code: 'EMAIL_NOT_VERIFIED' })
    expect(orders).toHaveLength(0)
    await useCases.create(order, { userId: 'u1', emailVerified: true })
    expect((orders[0] as unknown as { user_id: string }).user_id).toBe('u1')
  })

  it('rejects a size the product does not offer', async () => {
    const { useCases } = setup([product({})])
    await expect(
      useCases.create({ customer, items: [{ product_id: product({}).id, size: 'XXL', quantity: 1 }], payment_method: 'cash_on_delivery' as const, delivery_zone: 'abidjan' as const }),
    ).rejects.toThrow(/indisponible/)
  })

  it('sells size-less accessories as one size', async () => {
    const { useCases, orders } = setup([product({ category: 'accessories', sizes: [] })])
    await useCases.create({ customer, items: [{ product_id: product({}).id, quantity: 1 }], payment_method: 'cash_on_delivery' as const, delivery_zone: 'abidjan' as const })
    expect(orders[0]?.order_items?.[0]?.size).toBe('TU')
  })

  it('rejects unavailable products and oversize carts', async () => {
    const { useCases } = setup([product({ status: 'unavailable' })])
    await expect(
      useCases.create({ customer, items: [{ product_id: product({}).id, size: 'S', quantity: 1 }], payment_method: 'cash_on_delivery' as const, delivery_zone: 'abidjan' as const }),
    ).rejects.toThrow(/indisponible/)

    const small = setup([product({})], { max_items_per_order: 2 })
    await expect(
      small.useCases.create({ customer, items: [{ product_id: product({}).id, size: 'S', quantity: 3 }], payment_method: 'cash_on_delivery' as const, delivery_zone: 'abidjan' as const }),
    ).rejects.toThrow(/Maximum 2/)
  })
})

describe('orders.create — customer records (BOLA)', () => {
  const victim = { id: 'victim', first_name: 'Victime', last_name: 'V', phone: '0700000001', email: null, city: 'Bouaké', address: 'Rue 1' } as unknown as Customer
  const line = { product_id: product({}).id, size: 'M', quantity: 1 }

  it("refuses a phone number that belongs to another customer instead of taking over that record", async () => {
    const { useCases, customers, customerRepo } = setup([product({})], undefined, [victim])
    await expect(
      useCases.create(
        { customer: { ...customer, phone: '0700000001', email: 'someone-else@test.ci' }, items: [line], payment_method: 'cash_on_delivery' as const, delivery_zone: 'abidjan' as const },
        { userId: 'attacker', emailVerified: true, email: 'attacker@test.ci' },
      ),
    ).rejects.toMatchObject({ status: 409 })
    expect(customerRepo.update).not.toHaveBeenCalled()
    expect(customers.find((c) => c.id === 'victim')).toMatchObject({ email: null, first_name: 'Victime', address: 'Rue 1' })
  })

  it('binds the record to the account email, ignoring the email typed in the form', async () => {
    const { useCases, customers } = setup([product({})])
    await useCases.create(
      { customer: { ...customer, email: 'victim@test.ci' }, items: [line], payment_method: 'cash_on_delivery' as const, delivery_zone: 'abidjan' as const },
      { userId: 'u1', emailVerified: true, email: 'me@test.ci' },
    )
    expect(customers[0]?.email).toBe('me@test.ci')
  })

  it("updates the account's own record", async () => {
    const mine = { ...victim, id: 'mine', email: 'Me@Test.ci', phone: '0700000002' } as Customer
    const { useCases, customers } = setup([product({})], undefined, [mine])
    await useCases.create(
      { customer: { ...customer, phone: '0700000002', address: 'Nouvelle adresse' }, items: [line], payment_method: 'cash_on_delivery' as const, delivery_zone: 'abidjan' as const },
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
    await useCases.create({ customer, items: [{ product_id: product({}).id, size: 'M', quantity: 1 }], payment_method: 'cash_on_delivery' as const, delivery_zone: 'abidjan' as const })
    Object.assign(orders[0]!, { status: 'out_for_delivery', amount_paid: 10000, payment_status: 'partial' })
    await useCases.update('o1', { status: 'delivered', payment_status: 'paid' } as never)
    expect(orders[0]).toMatchObject({ status: 'delivered', payment_status: 'partial', amount_paid: 10000 })
  })
})

describe('orders.update — stock', () => {
  const line = { product_id: product({}).id, size: 'M', quantity: 1 }

  it('gives the stock back once when an order is cancelled or returned', async () => {
    const t = setup([product({})])
    await t.useCases.create({ customer, items: [line], payment_method: 'cash_on_delivery', delivery_zone: 'abidjan' })
    await t.useCases.update('o1', { status: 'cancelled' })
    expect(t.orderRepo.releaseStock).toHaveBeenCalledWith('o1', 'cancel')
    await expect(t.useCases.update('o1', { status: 'confirmed' })).rejects.toMatchObject({ status: 409 })

    const r = setup([product({})])
    await r.useCases.create({ customer, items: [line], payment_method: 'cash_on_delivery', delivery_zone: 'abidjan' })
    await expect(r.useCases.update('o1', { status: 'returned' })).rejects.toMatchObject({ status: 409 })
    await r.useCases.update('o1', { status: 'delivered' })
    expect(r.orderRepo.releaseStock).not.toHaveBeenCalled()
    await r.useCases.update('o1', { status: 'returned' })
    expect(r.orderRepo.releaseStock).toHaveBeenCalledWith('o1', 'return')
  })

  it('cancels online orders left unpaid, releasing their stock', async () => {
    const t = setup([product({})])
    await t.useCases.create({ customer, items: [line], payment_method: 'online', delivery_zone: 'abidjan' })
    await expect(t.useCases.expireUnpaidOnline()).resolves.toEqual({ cancelled: 1 })
    expect(t.orders[0]?.status).toBe('cancelled')
    expect(t.orderRepo.releaseStock).toHaveBeenCalledWith('o1', 'cancel')
  })
})

