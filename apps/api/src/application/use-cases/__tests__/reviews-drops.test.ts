import { describe, expect, it, vi } from 'vitest'
import type { Drop, Order, Product, ProductReview, SessionUser } from '@trs/shared'
import { makeReviewUseCases } from '../reviews'
import { makeDropUseCases } from '../drops'
import type { DropRepository, Mailer, OrderRepository, ProductRepository, ReviewRepository, ReviewWrite, SettingsRepository } from '../../ports'

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111'
const product = { id: PRODUCT_ID, name: 'Sacoche', slug: 'sacoche', price: 20000, is_active: true, product_media: [] } as unknown as Product
const user = { id: 'u1', email: 'awa@test.ci', first_name: 'Awa', last_name: 'Koné', email_verified: true, role: 'customer' } as SessionUser
const order = (status: Order['status']) =>
  ({ id: 'o1', status, order_items: [{ product_id: PRODUCT_ID, product_name: 'Sacoche' }], customers: { email: 'awa@test.ci', first_name: 'Awa' } }) as unknown as Order
const SUPABASE = 'https://proj.supabase.co'
const mailer = (): Mailer => ({ send: vi.fn(async () => true), status: () => ({ provider: 'smtp' as const, from: 'shop@test.ci', lastError: null }) })

function reviewSetup(orders: Order[]) {
  const store: ProductReview[] = []
  const reviews = {
    findByUserAndProduct: vi.fn(async (u: string, p: string) => store.find((r) => r.user_id === u && r.product_id === p) ?? null),
    create: vi.fn(async (data: ReviewWrite) => {
      const r = { ...data, id: `r${store.length + 1}`, admin_reply: null, created_at: '' } as ProductReview
      store.push(r)
      return r
    }),
    update: vi.fn(async (id: string, patch: Partial<ProductReview>) => Object.assign(store.find((r) => r.id === id)!, patch)),
    approvedRatings: vi.fn(async () => store.filter((r) => r.status === 'approved').map((r) => r.rating)),
    listApproved: vi.fn(async () => store.filter((r) => r.status === 'approved')),
    findById: vi.fn(async (id: string) => store.find((r) => r.id === id) ?? null),
  } as unknown as ReviewRepository
  const m = mailer()
  const useCases = makeReviewUseCases({
    reviews,
    orders: { listForAccount: vi.fn(async () => orders) } as unknown as OrderRepository,
    products: { findByIdOrSlug: vi.fn(async () => product), findManyByIds: vi.fn(async () => [product]) } as unknown as ProductRepository,
    mailer: m,
    config: { appUrl: 'https://shop.test', adminEmail: 'admin@shop.test', supabaseUrl: SUPABASE },
  })
  return { useCases, store, mailer: m }
}

describe('reviews', () => {
  it('accepts a review from a customer whose order was delivered, pending approval, with a short name', async () => {
    const t = reviewSetup([order('delivered')])
    const review = await t.useCases.submit(user, { product_id: PRODUCT_ID, rating: 5, title: ' Superbe ', body: 'Très belle finition' })
    expect(review).toMatchObject({ status: 'pending', author_name: 'Awa K.', title: 'Superbe', order_id: 'o1', user_id: 'u1' })
    expect(t.mailer.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'admin@shop.test' }))
  })

  it('refuses customers who did not receive the piece', async () => {
    await expect(reviewSetup([order('confirmed')]).useCases.submit(user, { product_id: PRODUCT_ID, rating: 4 })).rejects.toMatchObject({ status: 403 })
    await expect(reviewSetup([]).useCases.submit(user, { product_id: PRODUCT_ID, rating: 4 })).rejects.toMatchObject({ status: 403 })
  })

  it('only takes photos uploaded through the shop', async () => {
    const t = reviewSetup([order('delivered')])
    await expect(t.useCases.submit(user, { product_id: PRODUCT_ID, rating: 5, photo_url: 'https://evil.test/x.jpg' })).rejects.toMatchObject({ status: 400 })
    const ok = await t.useCases.submit(user, { product_id: PRODUCT_ID, rating: 5, photo_url: `${SUPABASE}/storage/v1/object/public/reviews/a.jpg` })
    expect(ok.photo_url).toContain('/reviews/a.jpg')
  })

  it('edits the existing review instead of adding a second one, and waits for approval again', async () => {
    const t = reviewSetup([order('delivered')])
    const first = await t.useCases.submit(user, { product_id: PRODUCT_ID, rating: 3 })
    await t.useCases.moderate(first.id, { status: 'approved' })
    await t.useCases.submit(user, { product_id: PRODUCT_ID, rating: 5 })
    expect(t.store).toHaveLength(1)
    expect(t.store[0]).toMatchObject({ rating: 5, status: 'pending' })
  })

  it('shows only approved reviews, without account or order ids', async () => {
    const t = reviewSetup([order('delivered')])
    const r = await t.useCases.submit(user, { product_id: PRODUCT_ID, rating: 4 })
    expect((await t.useCases.forProduct('sacoche')).summary.count).toBe(0)
    await t.useCases.moderate(r.id, { status: 'approved', admin_reply: ' Merci Awa ! ' })
    const page = await t.useCases.forProduct('sacoche')
    expect(page.summary).toMatchObject({ count: 1, average: 4 })
    expect(page.reviews[0]).not.toHaveProperty('user_id')
    expect(page.reviews[0]).toMatchObject({ admin_reply: 'Merci Awa !' })
  })

  it('invites the customer to review the delivered pieces', async () => {
    const t = reviewSetup([])
    await t.useCases.inviteAfterDelivery(order('delivered'))
    expect(t.mailer.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'awa@test.ci', html: expect.stringContaining('/product/sacoche#avis') }))
  })
})

describe('drops', () => {
  const drop = (over: Partial<Drop>): Drop => ({ id: 'd1', title: 'Capsule 02', description: '', image_url: null, starts_at: new Date(Date.now() + 86_400_000).toISOString(), product_ids: [PRODUCT_ID], location: '', is_published: true, preorders_open: false, ...over })

  function dropSetup(d: Drop, due: { id: string; email: string }[] = [], opts: { early?: { id: string; email: string }[]; listed?: boolean; settings?: Record<string, unknown> } = {}) {
    const repo = {
      dueEarlyAccess: vi.fn(async () => (opts.early?.length ? [{ drop: d, reminders: opts.early }] : [])),
      markEarlyNotified: vi.fn(async () => {}),
      hasEarlyAccess: vi.fn(async () => opts.listed ?? false),
      findById: vi.fn(async () => d),
      addReminder: vi.fn(async () => true),
      list: vi.fn(async () => [d]),
      dueReminders: vi.fn(async () => (due.length ? [{ drop: d, reminders: due }] : [])),
      markReminded: vi.fn(async () => {}),
    } as unknown as DropRepository
    const m = mailer()
    const useCases = makeDropUseCases({ drops: repo, products: { findManyByIds: vi.fn(async () => [product]) } as unknown as ProductRepository, mailer: m, settings: { getAll: vi.fn(async () => opts.settings ?? {}) } as unknown as SettingsRepository, config: { appUrl: 'https://shop.test' } })
    return { useCases, repo, mailer: m }
  }

  it('takes reminders only for an upcoming, published drop', async () => {
    expect(await dropSetup(drop({})).useCases.remind('d1', 'awa@test.ci')).toEqual({ success: true, already: false })
    await expect(dropSetup(drop({ starts_at: new Date(Date.now() - 3_600_000).toISOString() })).useCases.remind('d1', 'a@b.ci')).rejects.toMatchObject({ status: 409 })
    await expect(dropSetup(drop({ is_published: false })).useCases.remind('d1', 'a@b.ci')).rejects.toMatchObject({ status: 404 })
  })

  it('shows the calendar with the pieces', async () => {
    const [d] = await dropSetup(drop({})).useCases.calendar()
    expect(d?.products?.[0]).toMatchObject({ slug: 'sacoche', price: 20000 })
  })

  it('emails each waiting person once when the drop opens', async () => {
    const t = dropSetup(drop({}), [{ id: 'm1', email: 'a@b.ci' }, { id: 'm2', email: 'c@d.ci' }])
    expect(await t.useCases.processDueReminders()).toEqual({ drops: 1, sent: 2, early: 0 })
    expect(t.repo.markReminded).toHaveBeenCalledWith(['m1', 'm2'])
  })

  it('emails the early access to the people on the list when it starts', async () => {
    const t = dropSetup(drop({}), [], { early: [{ id: 'm1', email: 'a@b.ci' }] })
    expect(await t.useCases.processDueReminders()).toMatchObject({ early: 1 })
    expect(t.mailer.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'a@b.ci', subject: expect.stringContaining('accès anticipé'), html: expect.stringContaining('24 h avant') }))
    expect(t.repo.markEarlyNotified).toHaveBeenCalledWith(['m1'])
    expect(t.repo.dueEarlyAccess).toHaveBeenCalledWith(expect.any(String), 24, expect.any(Number))
  })

  it('tells a visitor where the drop stands and whether they are on the list', async () => {
    const inTwelveHours = new Date(Date.now() + 12 * 3_600_000).toISOString()
    const user = { id: 'u1', email: 'awa@test.ci' } as SessionUser
    expect(await dropSetup(drop({ starts_at: inTwelveHours }), [], { listed: true }).useCases.access('d1', user)).toMatchObject({ access: 'early', eligible: true, hours: 24 })
    expect(await dropSetup(drop({ starts_at: inTwelveHours }), [], { listed: false }).useCases.access('d1', user)).toMatchObject({ access: 'early', eligible: false })
    expect(await dropSetup(drop({ starts_at: inTwelveHours }), [], { listed: true }).useCases.access('d1', null)).toMatchObject({ access: 'early', eligible: false })
    // early access switched off in the back-office
    expect(await dropSetup(drop({ starts_at: inTwelveHours }), [], { listed: true, settings: { drop_early_access_hours: 0 } }).useCases.access('d1', user)).toMatchObject({ access: 'closed', eligible: false })
    expect(await dropSetup(drop({ starts_at: new Date(Date.now() - 60_000).toISOString() })).useCases.access('d1', null)).toMatchObject({ access: 'open', eligible: true })
    // a drop taking reservations: open to everyone before its date
    expect(await dropSetup(drop({ starts_at: inTwelveHours, preorders_open: true })).useCases.access('d1', null)).toMatchObject({ access: 'open', eligible: true })
  })
})
