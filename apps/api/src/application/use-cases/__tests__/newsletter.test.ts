import { describe, expect, it, vi } from 'vitest'
import type { NewsletterCampaign, Product, SessionUser } from '@trs/shared'
import { makeNewsletterUseCases } from '../newsletter'
import { recommend } from '../../recommendations'
import { personalize, renderNewsletter, safeUrl } from '../../templates/newsletter'
import type { Mailer, NewsletterDelivery, NewsletterRecipient, NewsletterRepository, ProductRepository, PurchaseHistoryRepository, UnsubscribeTokens } from '../../ports'

const APP = 'https://shop.ci'
const admin: SessionUser = { id: 'admin', email: 'admin@shop.ci', first_name: 'Yann', last_name: 'A', phone: null, role: 'admin' }
const p = (id: string, extra: Partial<Product> = {}) =>
  ({ id, slug: id, name: `P ${id}`, price: 10000, is_active: true, status: 'available', category: 'shoes', product_media: [], ...extra }) as unknown as Product

describe('email links and text', () => {
  it('only allows https, site paths and mailto — never javascript: or http:', () => {
    expect(safeUrl('/collection', APP)).toBe('https://shop.ci/collection')
    expect(safeUrl('https://instagram.com/x', APP)).toBe('https://instagram.com/x')
    expect(safeUrl('mailto:hi@shop.ci', APP)).toBe('mailto:hi@shop.ci')
    expect(safeUrl('javascript:alert(1)', APP)).toBeNull()
    expect(safeUrl('//evil.com', APP)).toBeNull()
    expect(safeUrl('http://evil.com', APP)).toBeNull()
    expect(safeUrl('mailto:hi@shop.ci', APP, { image: true })).toBeNull()
  })

  it('escapes every text and personalises {{prenom}}', () => {
    expect(personalize('Bonjour {{prenom}}, voici', 'Awa')).toBe('Bonjour Awa, voici')
    expect(personalize('Bonjour {{prénom}}, voici', null)).toBe('Bonjour, voici')
    const html = renderNewsletter({
      subject: 'S',
      preheader: '<b>pre</b>',
      blocks: [
        { id: '1', type: 'heading', text: '<script>alert(1)</script>' },
        { id: '2', type: 'image', url: 'javascript:alert(1)', alt: 'x' },
        { id: '3', type: 'button', label: 'Go', url: '/collection' },
      ],
      products: new Map(),
      recommendations: [],
      firstName: null,
      appUrl: APP,
      unsubscribeUrl: 'https://shop.ci/desinscription?e=a&t=b',
    })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('javascript:')
    expect(html).toContain('href="https://shop.ci/collection"')
    expect(html).toContain('Se désinscrire')
  })
})

describe('recommendations ("Pour vous")', () => {
  const catalog = [
    p('jordan-4', { collection_id: 'jordan', brand_id: 'nike', category: 'shoes' }),
    p('jordan-6', { collection_id: 'jordan', brand_id: 'nike', category: 'shoes' }),
    p('sb', { brand_id: 'nike', category: 'shoes' }),
    p('jeans', { category: 'clothing' }),
    p('gone', { collection_id: 'jordan', status: 'unavailable' }),
  ]
  it('favours the same collection, then brand, never what was bought nor unavailable pieces', () => {
    const bought = [p('jordan-3', { collection_id: 'jordan', brand_id: 'nike', category: 'shoes' })]
    expect(recommend(bought, [...catalog, bought[0]!], 3).map((x) => x.id)).toEqual(['jordan-4', 'jordan-6', 'sb'])
  })
  it('without purchases, suggests featured pieces first', () => {
    expect(recommend([], [p('a'), p('b', { is_featured: true })], 2).map((x) => x.id)).toEqual(['b', 'a'])
  })
})

// ------------------------------------------------------------ campaign flow
function setup(opts: { audience?: NewsletterRecipient[]; suppressed?: string[]; mailerOk?: boolean } = {}) {
  let campaign: NewsletterCampaign = {
    id: 'c1', title: 'Rentrée', subject: 'Nouveautés', preheader: '', audience: 'all', status: 'draft',
    blocks: [{ id: 'b', type: 'text', text: 'Bonjour {{prenom}}' }, { id: 'r', type: 'recommendations' }],
    scheduled_at: null, started_at: null, finished_at: null, recipients_count: 0, sent_count: 0, failed_count: 0, created_at: '', updated_at: '',
  }
  const deliveries: (NewsletterDelivery & { status: string })[] = []
  const suppressed = new Set(opts.suppressed ?? [])
  const repo = {
    get: vi.fn(async () => campaign),
    transition: vi.fn(async (_id: string, from: string[], to: NewsletterCampaign['status'], extra = {}) => {
      if (!from.includes(campaign.status)) return null
      campaign = { ...campaign, ...extra, status: to }
      return campaign
    }),
    due: vi.fn(async (now: Date) => (campaign.status === 'sending' || (campaign.status === 'scheduled' && new Date(campaign.scheduled_at!) <= now) ? [campaign] : [])),
    audience: vi.fn(async () => opts.audience ?? [{ email: 'awa@mail.ci', firstName: 'Awa', userId: 'u1' }, { email: 'gone@mail.ci', firstName: null, userId: null }]),
    enqueue: vi.fn(async (id: string, rs: NewsletterRecipient[]) => {
      for (const r of rs) if (!deliveries.some((x) => x.email === r.email)) deliveries.push({ id: `d${deliveries.length}`, campaignId: id, email: r.email, firstName: r.firstName, userId: r.userId, status: 'pending' })
      return deliveries.length
    }),
    claim: vi.fn(async (_id: string, limit: number) => {
      const batch = deliveries.filter((x) => x.status === 'pending').slice(0, limit)
      batch.forEach((x) => (x.status = 'sending'))
      return batch
    }),
    markDelivery: vi.fn(async (id: string, r: { status: string }) => void (deliveries.find((x) => x.id === id)!.status = r.status)),
    deliveryCounts: vi.fn(async () => {
      const c = { pending: 0, sending: 0, sent: 0, failed: 0, skipped: 0 } as Record<string, number>
      deliveries.forEach((x) => c[x.status]!++)
      return c as { pending: number; sending: number; sent: number; failed: number; skipped: number }
    }),
    skipPending: vi.fn(async () => deliveries.filter((x) => x.status === 'pending').forEach((x) => (x.status = 'skipped'))),
    isSuppressed: vi.fn(async (e: string) => suppressed.has(e)),
    suppress: vi.fn(async (e: string) => void suppressed.add(e)),
    verifyCronSecret: vi.fn(async (t: string) => t === 'd'.repeat(64)),
  } as unknown as NewsletterRepository
  const purchases: PurchaseHistoryRepository = { purchasedProductIds: vi.fn(async () => ['bought']) }
  const products = {
    findManyByIds: vi.fn(async (ids: string[]) => ids.map((id) => p(id, { collection_id: 'jordan' }))),
    list: vi.fn(async () => ({ items: [p('bought', { collection_id: 'jordan' }), p('match', { collection_id: 'jordan' }), p('other')], total: 3 })),
  } as unknown as ProductRepository
  const sent: { to: string; html: string; headers?: Record<string, string> }[] = []
  const mailer: Mailer = {
    send: vi.fn(async (m) => (opts.mailerOk === false ? false : (sent.push(m), true))),
    status: () => ({ provider: 'smtp', from: 'shop@gmail.com', lastError: opts.mailerOk === false ? 'EAUTH' : null }),
  }
  const unsubscribe: UnsubscribeTokens = { sign: (e) => `sig-${e}-xxxxxxxxxxxxxxxx`, verify: (e, t) => t === `sig-${e}-xxxxxxxxxxxxxxxx` }
  let clock = new Date('2026-10-02T10:00:00Z')
  const uc = makeNewsletterUseCases({ newsletter: repo, purchases, products, mailer, unsubscribe, config: { appUrl: APP }, now: () => clock, pause: async () => undefined })
  return { uc, sent, deliveries, get campaign() { return campaign }, tick: (ms: number) => (clock = new Date(clock.getTime() + ms)), repo }
}

describe('campaign scheduling and sending', () => {
  it('waits for its time, then emails each consenting address once, personalised', async () => {
    const t = setup()
    await t.uc.schedule('c1', new Date('2026-10-02T12:00:00Z'))
    expect((await t.uc.processDue()).processed).toHaveLength(0) // not yet
    t.tick(3 * 3600_000)
    await t.uc.processDue()
    expect(t.campaign.status).toBe('sent')
    expect(t.sent.map((m) => m.to)).toEqual(['awa@mail.ci', 'gone@mail.ci'])
    expect(t.sent[0]!.html).toContain('Bonjour Awa')
    expect(t.sent[0]!.html).toContain('P match') // recommended from the same collection
    expect(t.sent[0]!.html).not.toContain('P bought')
    expect(t.sent[0]!.headers?.['List-Unsubscribe']).toContain('/api/newsletter/unsubscribe?e=awa%40mail.ci')
    // Running the worker again never re-sends
    await t.uc.processDue()
    expect(t.sent).toHaveLength(2)
    expect(t.campaign).toMatchObject({ sent_count: 2, failed_count: 0 })
  })

  it('skips addresses that unsubscribed after the list was built', async () => {
    const t = setup({ suppressed: ['gone@mail.ci'] })
    await t.uc.sendNow('c1')
    await t.uc.processDue()
    expect(t.sent.map((m) => m.to)).toEqual(['awa@mail.ci'])
    expect(t.deliveries.find((d) => d.email === 'gone@mail.ci')?.status).toBe('skipped')
  })

  it('marks the campaign failed when nothing could be sent', async () => {
    const t = setup({ mailerOk: false })
    await t.uc.sendNow('c1')
    await t.uc.processDue()
    expect(t.campaign).toMatchObject({ status: 'failed', failed_count: 2 })
  })

  it('refuses past dates, empty campaigns and editing a sent campaign', async () => {
    const t = setup()
    await expect(t.uc.schedule('c1', new Date('2026-10-01T00:00:00Z'))).rejects.toMatchObject({ status: 400 })
    await t.uc.sendNow('c1')
    await t.uc.processDue()
    await expect(t.uc.update('c1', { subject: 'x' })).rejects.toMatchObject({ status: 409 })
  })

  it('cancelling stops pending deliveries', async () => {
    const t = setup()
    await t.uc.schedule('c1', new Date('2026-10-02T10:30:00Z'))
    await t.uc.cancel('c1')
    t.tick(3600_000)
    await t.uc.processDue()
    expect(t.sent).toHaveLength(0)
    expect(t.campaign.status).toBe('cancelled')
  })

  it('unsubscribes only with a valid signed link', async () => {
    const t = setup()
    await expect(t.uc.unsubscribe('awa@mail.ci', 'forged-token-forged-token')).rejects.toMatchObject({ status: 400 })
    expect(await t.uc.unsubscribe('AWA@mail.ci', 'sig-awa@mail.ci-xxxxxxxxxxxxxxxx')).toEqual({ unsubscribed: true, email: 'awa@mail.ci' })
    expect(t.repo.suppress).toHaveBeenCalledWith('awa@mail.ci', 'unsubscribed')
  })

  it('test emails only go to the admin', async () => {
    const t = setup()
    const res = await t.uc.sendTest(admin, 'c1')
    expect(res).toMatchObject({ sent: true, to: 'admin@shop.ci' })
    expect(t.sent[0]).toMatchObject({ to: 'admin@shop.ci' })
  })
})

describe('scheduler authentication', () => {
  it('accepts the Vercel CRON_SECRET or the database-held secret, nothing else', async () => {
    const { uc } = setup()
    expect(await uc.isSchedulerCall('env-secret-env-secret-env-secret-xx', 'env-secret-env-secret-env-secret-xx')).toBe(true)
    expect(await uc.isSchedulerCall('d'.repeat(64), undefined)).toBe(true)
    expect(await uc.isSchedulerCall('', 'x')).toBe(false)
    expect(await uc.isSchedulerCall('short', undefined)).toBe(false)
    expect(await uc.isSchedulerCall('e'.repeat(64), 'env-secret-env-secret-env-secret-xx')).toBe(false)
  })
})

// ------------------------------------------------- new piece announcements
describe('announcing a new piece', () => {
  function announcer(start: Partial<NewsletterCampaign>[] = [], nowAt = new Date('2026-10-21T10:00:00Z')) {
    const campaigns: NewsletterCampaign[] = start.map((c, i) => ({
      id: `x${i}`, title: 'Nouveautés (envoi automatique)', subject: 's', preheader: '', audience: 'all', status: 'scheduled', blocks: [],
      scheduled_at: null, started_at: null, finished_at: null, recipients_count: 0, sent_count: 0, failed_count: 0, created_at: '', updated_at: '', ...c,
    }))
    const repo = {
      list: vi.fn(async () => campaigns),
      create: vi.fn(async (data: Partial<NewsletterCampaign>) => {
        const c = { id: `c${campaigns.length}`, status: 'draft', scheduled_at: null, started_at: null, finished_at: null, recipients_count: 0, sent_count: 0, failed_count: 0, created_at: '', updated_at: '', ...data } as NewsletterCampaign
        campaigns.push(c)
        return c
      }),
      update: vi.fn(async (id: string, patch: Partial<NewsletterCampaign>) => {
        const c = campaigns.find((x) => x.id === id)!
        Object.assign(c, patch)
        return c
      }),
      transition: vi.fn(async (id: string, from: string[], to: NewsletterCampaign['status'], extra = {}) => {
        const c = campaigns.find((x) => x.id === id)
        if (!c || !from.includes(c.status)) return null
        Object.assign(c, extra, { status: to })
        return c
      }),
    } as unknown as NewsletterRepository
    const uc = makeNewsletterUseCases({
      newsletter: repo,
      purchases: {} as PurchaseHistoryRepository,
      products: {} as ProductRepository,
      mailer: {} as Mailer,
      unsubscribe: {} as UnsubscribeTokens,
      config: { appUrl: APP },
      now: () => nowAt,
    })
    return { uc, campaigns, repo }
  }
  const productsOf = (c: NewsletterCampaign) => c.blocks.flatMap((b) => (b.type === 'products' ? b.productIds : []))

  it('schedules an email to every consenting address, 15 minutes later, with the piece in it', async () => {
    const { uc, campaigns } = announcer()
    expect(await uc.announceProduct({ id: 'a', name: 'Polo noir', is_active: true })).toMatchObject({ queued: true, joined: false })
    expect(campaigns).toHaveLength(1)
    expect(campaigns[0]).toMatchObject({ status: 'scheduled', audience: 'all', subject: 'Nouveau : Polo noir', scheduled_at: '2026-10-21T10:15:00.000Z' })
    expect(productsOf(campaigns[0]!)).toEqual(['a'])
  })

  it('pieces published within the delay share one email', async () => {
    const { uc, campaigns } = announcer([{ blocks: [{ id: 'p', type: 'products', productIds: ['a'] }], scheduled_at: '2026-10-21T10:10:00.000Z' }])
    expect(await uc.announceProduct({ id: 'b', name: 'T-shirt', is_active: true })).toMatchObject({ queued: true, joined: true })
    expect(campaigns).toHaveLength(1)
    expect(productsOf(campaigns[0]!)).toEqual(['a', 'b'])
    expect(campaigns[0]?.subject).toContain('Nouveautés')
  })

  it('starts a new email once the previous one is about to leave or is full', async () => {
    const soon = announcer([{ blocks: [{ id: 'p', type: 'products', productIds: ['a'] }], scheduled_at: '2026-10-21T10:00:30.000Z' }])
    await soon.uc.announceProduct({ id: 'b', name: 'B', is_active: true })
    expect(soon.campaigns).toHaveLength(2)
    const full = announcer([{ blocks: [{ id: 'p', type: 'products', productIds: ['1', '2', '3', '4', '5', '6'] }], scheduled_at: '2026-10-21T10:10:00.000Z' }])
    await full.uc.announceProduct({ id: 'b', name: 'B', is_active: true })
    expect(full.campaigns).toHaveLength(2)
  })

  it('never announces a piece twice, nor a hidden one', async () => {
    const sent = announcer([{ status: 'sent', blocks: [{ id: 'p', type: 'products', productIds: ['a'] }] }])
    expect(await sent.uc.announceProduct({ id: 'a', name: 'A', is_active: true })).toMatchObject({ queued: false, reason: 'already' })
    expect(sent.campaigns).toHaveLength(1)
    const hidden = announcer()
    expect(await hidden.uc.announceProduct({ id: 'h', name: 'H', is_active: false })).toMatchObject({ queued: false, reason: 'inactive' })
    expect(hidden.campaigns).toHaveLength(0)
  })

  it('a piece whose email was cancelled can be announced again', async () => {
    const { uc, campaigns } = announcer([{ status: 'cancelled', blocks: [{ id: 'p', type: 'products', productIds: ['a'] }] }])
    await uc.announceProduct({ id: 'a', name: 'A', is_active: true })
    expect(campaigns).toHaveLength(2)
  })
})
