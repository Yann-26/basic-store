import { describe, expect, it, vi } from 'vitest'
import type { Order, Payment, PaymentStatus, SessionUser } from '@trs/shared'
import { makePaymentUseCases } from '../payments'
import type { OrderRepository, PaymentGateway, PaymentRepository } from '../../ports'

const ORDER_ID = '11111111-1111-4111-8111-111111111111'
const owner: SessionUser = { id: 'u-owner', email: 'owner@test.ci', first_name: 'O', last_name: 'W', role: 'customer', email_verified: true }
const stranger: SessionUser = { ...owner, id: 'u-stranger', email: 'stranger@test.ci' }
const admin: SessionUser = { ...owner, id: 'u-admin', email: 'admin@test.ci', role: 'admin' }

type StoredPayment = Payment & { metadata?: Record<string, unknown> | null }

/** In-memory payments table with the same conditional-update semantics as the database. */
function fakePayments(initial: StoredPayment[] = []) {
  const rows = [...initial]
  const repo: PaymentRepository = {
    create: vi.fn(async ({ received, method = 'paystack', ...p }) => {
      rows.push({ ...p, method, ...(received ? { status: 'success', ...received } : { status: 'pending' }), created_at: new Date().toISOString(), id: `p${rows.length}` } as StoredPayment)
    }),
    findByReference: vi.fn(async (ref: string) => rows.find((r) => r.reference === ref) ?? null),
    findOpenForOrder: vi.fn(async (orderId: string, since: string) =>
      [...rows].reverse().find((r) => r.order_id === orderId && r.status === 'pending' && r.created_at >= since) ?? null,
    ),
    update: vi.fn(async (ref: string, patch) => {
      Object.assign(rows.find((r) => r.reference === ref)!, patch)
    }),
    transition: vi.fn(async (ref: string, from: PaymentStatus[], patch) => {
      const row = rows.find((r) => r.reference === ref)
      if (!row || !from.includes(row.status)) return false
      Object.assign(row, patch)
      return true
    }),
    list: vi.fn(),
    listAll: vi.fn(),
  }
  return { rows, repo }
}

type GatewayAnswer = { status: string; amount: number; currency: string | null; channel: string | null; paidAt: string | null }

function setup(opts: { order?: Partial<Order>; payments?: StoredPayment[]; paystack?: Partial<GatewayAnswer>; validSignature?: boolean } = {}) {
  const order = {
    id: ORDER_ID,
    preorder_number: 'TRS-2026-ABCDEFGH',
    status: 'pending',
    payment_status: 'pending',
    total_price: 20000,
    amount_paid: 0,
    deposit_amount: 7000,
    customer_id: 'c1',
    user_id: owner.id,
    customers: { email: 'owner@test.ci' },
    ...opts.order,
  } as Order
  const orderRepo = {
    findById: vi.fn(async (id: string) => (id === order.id ? order : null)),
    update: vi.fn(async (_id: string, patch: Partial<Order>) => Object.assign(order, patch)),
    addTracking: vi.fn(async () => {}),
    // Same arithmetic as the apply_order_payment SQL function.
    applyPayment: vi.fn(async (_id: string, amount: number) => {
      const paid = Math.max(0, (order.amount_paid ?? 0) + amount)
      order.amount_paid = paid
      order.payment_status = paid >= order.total_price ? 'paid' : paid > 0 ? 'deposit_paid' : amount < 0 ? 'refunded' : order.payment_status
      return { amount_paid: paid, total_price: order.total_price, payment_status: order.payment_status }
    }),
  } as unknown as OrderRepository
  const { rows, repo } = fakePayments(opts.payments)
  const mailer = { send: vi.fn(async () => true), status: vi.fn() }
  const gateway = {
    initialize: vi.fn(async (p: { reference: string }) => ({ authorizationUrl: `https://checkout.paystack.com/${p.reference}`, reference: p.reference })),
    verify: vi.fn(async (): Promise<GatewayAnswer> => ({ status: 'success', amount: 7000, currency: 'XOF', channel: 'mobile_money', paidAt: '2026-10-28T10:00:00Z', ...opts.paystack })),
    isValidWebhookSignature: vi.fn(() => opts.validSignature ?? true),
  } satisfies PaymentGateway
  const payments = makePaymentUseCases({
    orders: orderRepo,
    payments: repo,
    gateway,
    mailer,
    config: { appUrl: 'https://shop.test', adminEmail: 'shop@test.ci' },
  })
  return { payments, order, orderRepo, rows, mailer, gateway }
}

const pending = (over: Partial<StoredPayment> = {}): StoredPayment =>
  ({ id: 'p0', reference: 'TRS-1-AAAA', order_id: ORDER_ID, amount: 7000, status: 'pending', kind: 'deposit', method: 'wave', customer_email: 'o@t.ci', created_at: new Date().toISOString(), ...over }) as StoredPayment

describe('payments.initialize — the Paystack checkout', () => {
  it("refuses someone else's order with 404 (no id probing)", async () => {
    const { payments, rows } = setup()
    await expect(payments.initialize({ orderId: ORDER_ID }, stranger)).rejects.toMatchObject({ status: 404 })
    expect(rows).toHaveLength(0)
  })

  it('refuses orders without an owner to customers, allows admins', async () => {
    const { payments } = setup({ order: { user_id: null } })
    await expect(payments.initialize({ orderId: ORDER_ID }, owner)).rejects.toMatchObject({ status: 404 })
    await expect(payments.initialize({ orderId: ORDER_ID }, admin)).resolves.toMatchObject({ amount: 20000 })
  })

  it('opens Paystack for everything still due, decided by the server, ignoring any client amount', async () => {
    const { payments, rows, gateway } = setup()
    const res = await payments.initialize({ orderId: ORDER_ID, amount: 1 } as never, owner)
    expect(res).toMatchObject({ amount: 20000, kind: 'deposit', authorization_url: expect.stringContaining('checkout.paystack.com') })
    expect(gateway.initialize).toHaveBeenCalledWith(expect.objectContaining({ amount: 20000, email: 'owner@test.ci', callbackUrl: 'https://shop.test/payment/callback' }))
    expect(rows[0]).toMatchObject({ amount: 20000, kind: 'deposit', method: 'paystack', status: 'pending' })
  })

  it('then the balance, once something was paid', async () => {
    const { payments } = setup({ order: { amount_paid: 7000, status: 'out_for_delivery', payment_status: 'deposit_paid' } })
    expect(await payments.initialize({ orderId: ORDER_ID }, owner)).toMatchObject({ amount: 13000, kind: 'balance' })
  })

  it('hands the open checkout out again instead of creating another', async () => {
    const { payments, rows } = setup()
    const first = await payments.initialize({ orderId: ORDER_ID }, owner)
    const second = await payments.initialize({ orderId: ORDER_ID }, owner)
    expect(second.reference).toBe(first.reference)
    expect(rows).toHaveLength(1)
    expect(first.reference).toMatch(/^BS-\d+-[A-Z0-9]{8}$/)
  })

  it('marks the payment failed when Paystack cannot open the checkout', async () => {
    const { payments, rows, gateway } = setup()
    gateway.initialize.mockRejectedValueOnce(new Error('Paystack down'))
    await expect(payments.initialize({ orderId: ORDER_ID }, owner)).rejects.toThrow('Paystack down')
    expect(rows[0]?.status).toBe('failed')
  })

  it('refuses a fully paid or cancelled order', async () => {
    await expect(setup({ order: { amount_paid: 20000, payment_status: 'paid' } }).payments.initialize({ orderId: ORDER_ID }, owner)).rejects.toMatchObject({ status: 409 })
    await expect(setup({ order: { status: 'cancelled' } }).payments.initialize({ orderId: ORDER_ID }, owner)).rejects.toMatchObject({ status: 409 })
  })
})

describe('payments.verify — back from Paystack', () => {
  const open = () => pending({ reference: 'SC-1-AAAAAAAA', method: 'paystack' })

  it('credits the order once Paystack confirms the full amount, and confirms the order', async () => {
    const { payments, order, mailer } = setup({ payments: [open()], order: { customers: { email: 'owner@test.ci', first_name: 'Awa' } } })
    const res = await payments.verify('sc-1-aaaaaaaa')
    expect(res).toMatchObject({ status: 'success', amount: 7000, preorder_number: 'TRS-2026-ABCDEFGH', first_name: 'Awa' })
    expect(order.amount_paid).toBe(7000)
    expect(order.status).toBe('confirmed')
    expect(mailer.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'owner@test.ci' }))
  })

  it('never credits less than expected, or another currency', async () => {
    const short = setup({ payments: [open()], paystack: { amount: 500 } })
    expect((await short.payments.verify('SC-1-AAAAAAAA')).status).toBe('review')
    expect(short.order.amount_paid).toBe(0)
    const usd = setup({ payments: [open()], paystack: { currency: 'USD' } })
    expect((await usd.payments.verify('SC-1-AAAAAAAA')).status).not.toBe('success')
  })

  it('records an abandoned checkout as failed', async () => {
    const { payments, rows } = setup({ payments: [open()], paystack: { status: 'abandoned' } })
    expect((await payments.verify('SC-1-AAAAAAAA')).status).toBe('abandoned')
    expect(rows[0]?.status).toBe('failed')
  })

  it('a second return does not credit again', async () => {
    const { payments, order } = setup({ payments: [open()] })
    await payments.verify('SC-1-AAAAAAAA')
    await payments.verify('SC-1-AAAAAAAA')
    expect(order.amount_paid).toBe(7000)
  })

  it('refuses a malformed reference', async () => {
    await expect(setup().payments.verify('../../etc')).rejects.toMatchObject({ status: 400 })
  })
})

describe('payments.handleWebhook — Paystack notifications', () => {
  const open = () => pending({ reference: 'SC-1-AAAAAAAA', method: 'paystack' })
  const body = (event: string, data: Record<string, unknown>) => JSON.stringify({ event, data })

  it('refuses an unsigned or forged notification', async () => {
    const { payments, order } = setup({ payments: [open()], validSignature: false })
    await expect(payments.handleWebhook(body('charge.success', { reference: 'SC-1-AAAAAAAA' }), 'bad')).rejects.toMatchObject({ status: 401 })
    expect(order.amount_paid).toBe(0)
  })

  it('re-checks with Paystack before crediting, and never twice with the customer’s return', async () => {
    const { payments, order, gateway } = setup({ payments: [open()] })
    await payments.handleWebhook(body('charge.success', { reference: 'SC-1-AAAAAAAA', amount: 999999999 }), 'sig')
    await payments.verify('SC-1-AAAAAAAA')
    expect(gateway.verify).toHaveBeenCalled()
    expect(order.amount_paid).toBe(7000)
  })

  it('a late failure never overrides a success; a refund takes the money back once', async () => {
    const { payments, order, rows } = setup({ payments: [open()] })
    await payments.verify('SC-1-AAAAAAAA')
    await payments.handleWebhook(body('charge.failed', { reference: 'SC-1-AAAAAAAA' }), 'sig')
    expect(rows[0]?.status).toBe('success')
    await payments.handleWebhook(body('refund.processed', { transaction_reference: 'SC-1-AAAAAAAA' }), 'sig')
    await payments.handleWebhook(body('refund.processed', { transaction_reference: 'SC-1-AAAAAAAA' }), 'sig')
    expect(rows[0]?.status).toBe('refunded')
    expect(order.amount_paid).toBe(0)
  })
})

describe('payments.confirm / reject — older Wave payments checked by the shop', () => {
  it('confirming credits the order once and emails a receipt', async () => {
    const { payments, rows, order, orderRepo, mailer } = setup({ payments: [pending({ metadata: { declared_at: 'x' } })] })
    await payments.confirm('TRS-1-AAAA', admin)
    expect(rows[0]).toMatchObject({ status: 'success', channel: 'wave', recorded_by: admin.id })
    expect(order).toMatchObject({ amount_paid: 7000, payment_status: 'deposit_paid', status: 'confirmed' })
    expect(orderRepo.applyPayment).toHaveBeenCalledTimes(1)
    expect(mailer.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'owner@test.ci' }))
    await expect(payments.confirm('TRS-1-AAAA', admin)).rejects.toMatchObject({ status: 409 })
    expect(orderRepo.applyPayment).toHaveBeenCalledTimes(1)
  })

  it('two admins confirming at the same time credit it once', async () => {
    const { payments, orderRepo } = setup({ payments: [pending()] })
    await Promise.allSettled([payments.confirm('TRS-1-AAAA', admin), payments.confirm('TRS-1-AAAA', admin)])
    expect(orderRepo.applyPayment).toHaveBeenCalledTimes(1)
  })

  it('a balance confirmed in full makes the order paid at 100 %', async () => {
    const { payments, order } = setup({
      order: { amount_paid: 7000, status: 'delivered', payment_status: 'deposit_paid' },
      payments: [pending({ amount: 13000, kind: 'balance' })],
    })
    await payments.confirm('TRS-1-AAAA', admin)
    expect(order).toMatchObject({ amount_paid: 20000, payment_status: 'paid', status: 'delivered' })
  })

  it('refuses to confirm more than what is left', async () => {
    const { payments, rows } = setup({ order: { amount_paid: 15000 }, payments: [pending({ amount: 7000 })] })
    await expect(payments.confirm('TRS-1-AAAA', admin)).rejects.toMatchObject({ status: 409 })
    expect(rows[0]?.status).toBe('pending')
  })

  it('rejecting never counts the money', async () => {
    const { payments, rows, order, orderRepo } = setup({ payments: [pending()] })
    await payments.reject('TRS-1-AAAA', { reason: 'Rien reçu sur Wave' }, admin)
    expect(rows[0]).toMatchObject({ status: 'failed', error_message: 'Rien reçu sur Wave' })
    expect(order.amount_paid).toBe(0)
    expect(orderRepo.applyPayment).not.toHaveBeenCalled()
    await expect(payments.confirm('TRS-1-AAAA', admin)).rejects.toMatchObject({ status: 409 })
  })

  it('only knows Wave payments, by a well-formed reference', async () => {
    const { payments } = setup({ payments: [pending({ method: 'cash' })] })
    await expect(payments.confirm('TRS-1-AAAA', admin)).rejects.toMatchObject({ status: 404 })
    await expect(payments.confirm('nope', admin)).rejects.toMatchObject({ status: 400 })
  })
})

describe('payments — money received by hand', () => {
  it('records cash as a successful payment and adds it to the order', async () => {
    const { payments, order, rows } = setup({ order: { amount_paid: 7000, status: 'delivered', payment_status: 'deposit_paid' } })
    await payments.recordManual(ORDER_ID, { amount: 13000, method: 'cash', note: 'Payé au livreur' }, admin)
    expect(rows[0]).toMatchObject({ amount: 13000, status: 'success', kind: 'balance', method: 'cash', recorded_by: admin.id, note: 'Payé au livreur' })
    expect(order).toMatchObject({ amount_paid: 20000, payment_status: 'paid' })
  })

  it('confirms a pending order when the deposit is paid in cash', async () => {
    const { payments, order, rows } = setup()
    await payments.recordManual(ORDER_ID, { amount: 7000, method: 'mobile_money' }, admin)
    expect(rows[0]?.kind).toBe('deposit')
    expect(order).toMatchObject({ status: 'confirmed', amount_paid: 7000, payment_status: 'deposit_paid' })
  })

  it('refuses more than what is left, and anything on a paid or cancelled order', async () => {
    const partly = setup({ order: { amount_paid: 7000, payment_status: 'deposit_paid' } })
    await expect(partly.payments.recordManual(ORDER_ID, { amount: 13001, method: 'cash' }, admin)).rejects.toMatchObject({ status: 400 })
    expect(partly.rows).toHaveLength(0)
    await expect(setup({ order: { amount_paid: 20000 } }).payments.recordManual(ORDER_ID, { amount: 1, method: 'cash' }, admin)).rejects.toMatchObject({ status: 409 })
    await expect(setup({ order: { status: 'cancelled' } }).payments.recordManual(ORDER_ID, { amount: 1, method: 'cash' }, admin)).rejects.toMatchObject({ status: 409 })
  })
})

describe('payments.remind', () => {
  it('emails what is left with the link to pay it', async () => {
    const { payments, mailer } = setup({ order: { amount_paid: 7000, status: 'delivered' } })
    const res = await payments.remind(ORDER_ID)
    expect(res).toMatchObject({ sent: true, outstanding: 13000, payUrl: 'https://shop.test/payer/TRS-2026-ABCDEFGH' })
    expect(mailer.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'owner@test.ci' }))
  })

  it('has nothing to remind once paid at 100 %', async () => {
    await expect(setup({ order: { amount_paid: 20000 } }).payments.remind(ORDER_ID)).rejects.toMatchObject({ status: 409 })
  })
})
