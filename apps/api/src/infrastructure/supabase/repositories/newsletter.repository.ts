import type { NewsletterAudience, NewsletterCampaign, NewsletterStatus } from '@trs/shared'
import type {
  NewsletterCampaignWrite,
  NewsletterDelivery,
  NewsletterRecipient,
  NewsletterRepository,
  NewsletterSubscriberRow,
  PurchaseHistoryRepository,
} from '@/application/ports'
import { db, unwrap } from '../client'

type Row = Record<string, unknown>
const PAGE = 1000 // PostgREST returns at most 1000 rows per request

/** Reads every row of a query, page by page. */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, context: string): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw new Error(`[${context}] ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) return rows
  }
}

function toCampaign(r: Row): NewsletterCampaign {
  return {
    id: String(r.id),
    title: String(r.title ?? ''),
    subject: String(r.subject ?? ''),
    preheader: String(r.preheader ?? ''),
    blocks: Array.isArray(r.blocks) ? (r.blocks as NewsletterCampaign['blocks']) : [],
    audience: r.audience === 'buyers' ? 'buyers' : 'all',
    status: r.status as NewsletterStatus,
    scheduled_at: (r.scheduled_at as string | null) ?? null,
    started_at: (r.started_at as string | null) ?? null,
    finished_at: (r.finished_at as string | null) ?? null,
    recipients_count: Number(r.recipients_count) || 0,
    sent_count: Number(r.sent_count) || 0,
    failed_count: Number(r.failed_count) || 0,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  }
}

const lower = (e: unknown) => String(e ?? '').trim().toLowerCase()

export class SupabaseNewsletterRepository implements NewsletterRepository, PurchaseHistoryRepository {
  async list() {
    const data = unwrap(await db().from('newsletter_campaigns').select('*').order('created_at', { ascending: false }).limit(200), 'newsletter.list')
    return (data ?? []).map(toCampaign)
  }

  async get(id: string) {
    const data = unwrap(await db().from('newsletter_campaigns').select('*').eq('id', id).maybeSingle(), 'newsletter.get')
    return data ? toCampaign(data) : null
  }

  async create(data: NewsletterCampaignWrite & { created_by: string | null }) {
    return toCampaign(unwrap(await db().from('newsletter_campaigns').insert(data).select('*').single(), 'newsletter.create') as Row)
  }

  async update(id: string, patch: Partial<NewsletterCampaignWrite>) {
    return toCampaign(unwrap(await db().from('newsletter_campaigns').update(patch).eq('id', id).select('*').single(), 'newsletter.update') as Row)
  }

  async delete(id: string) {
    unwrap(await db().from('newsletter_campaigns').delete().eq('id', id), 'newsletter.delete')
  }

  async transition(id: string, from: NewsletterStatus[], to: NewsletterStatus, extra: Partial<NewsletterCampaign> = {}) {
    const data = unwrap(
      await db().from('newsletter_campaigns').update({ ...extra, status: to }).eq('id', id).in('status', from).select('*').maybeSingle(),
      'newsletter.transition',
    )
    return data ? toCampaign(data) : null
  }

  async due(now: Date) {
    const data = unwrap(
      await db()
        .from('newsletter_campaigns')
        .select('*')
        .or(`and(status.eq.scheduled,scheduled_at.lte.${now.toISOString()}),status.eq.sending`)
        .order('scheduled_at', { ascending: true })
        .limit(20),
      'newsletter.due',
    )
    return (data ?? []).map(toCampaign)
  }

  async audience(audience: NewsletterAudience): Promise<NewsletterRecipient[]> {
    const [subscribers, users, suppressed] = await Promise.all([
      fetchAll<Row>((a, b) => db().from('newsletter_subscribers').select('email, first_name').is('unsubscribed_at', null).range(a, b), 'newsletter.subscribers'),
      fetchAll<Row>((a, b) => db().from('users').select('id, email, first_name').eq('marketing_opt_in', true).eq('is_active', true).range(a, b), 'newsletter.optedIn'),
      fetchAll<Row>((a, b) => db().from('newsletter_suppressions').select('email').range(a, b), 'newsletter.suppressions'),
    ])
    const blocked = new Set(suppressed.map((r) => lower(r.email)))
    const byEmail = new Map<string, NewsletterRecipient>()
    for (const s of subscribers) {
      const email = lower(s.email)
      if (email && !blocked.has(email)) byEmail.set(email, { email, firstName: (s.first_name as string) || null, userId: null })
    }
    // A customer account wins (first name, purchase history for recommendations).
    for (const u of users) {
      const email = lower(u.email)
      if (email && !blocked.has(email)) byEmail.set(email, { email, firstName: (u.first_name as string) || null, userId: String(u.id) })
    }
    const all = [...byEmail.values()]
    if (audience === 'all') return all

    const orders = await fetchAll<Row>((a, b) => db().from('orders').select('user_id, customer_id').range(a, b), 'newsletter.orders')
    const buyerUsers = new Set(orders.map((o) => o.user_id).filter(Boolean).map(String))
    const customerIds = [...new Set(orders.map((o) => o.customer_id).filter(Boolean).map(String))]
    const buyerEmails = new Set<string>()
    for (let i = 0; i < customerIds.length; i += 200) {
      const rows = unwrap(await db().from('customers').select('email').in('id', customerIds.slice(i, i + 200)), 'newsletter.customers') ?? []
      for (const r of rows) if (r.email) buyerEmails.add(lower(r.email))
    }
    return all.filter((r) => (r.userId && buyerUsers.has(r.userId)) || buyerEmails.has(r.email))
  }

  async countAudience() {
    const [all, buyers] = await Promise.all([this.audience('all'), this.audience('buyers')])
    return { all: all.length, buyers: buyers.length }
  }

  async enqueue(campaignId: string, recipients: NewsletterRecipient[]) {
    for (let i = 0; i < recipients.length; i += 500) {
      const rows = recipients.slice(i, i + 500).map((r) => ({ campaign_id: campaignId, email: r.email, first_name: r.firstName, user_id: r.userId }))
      unwrap(await db().from('newsletter_deliveries').upsert(rows, { onConflict: 'campaign_id,email', ignoreDuplicates: true }), 'newsletter.enqueue')
    }
    const { count, error } = await db().from('newsletter_deliveries').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId)
    if (error) throw new Error(`[newsletter.enqueue] ${error.message}`)
    return count ?? 0
  }

  async claim(campaignId: string, limit: number): Promise<NewsletterDelivery[]> {
    const data = unwrap(await db().rpc('claim_newsletter_deliveries', { p_campaign: campaignId, p_limit: limit }), 'newsletter.claim')
    return ((data as Row[] | null) ?? []).map((r) => ({
      id: String(r.id),
      campaignId: String(r.campaign_id),
      email: String(r.email),
      firstName: (r.first_name as string) || null,
      userId: (r.user_id as string) || null,
    }))
  }

  async markDelivery(id: string, result: { status: 'sent' | 'failed' | 'skipped'; error?: string | null }) {
    unwrap(
      await db()
        .from('newsletter_deliveries')
        .update({ status: result.status, error: result.error ?? null, sent_at: result.status === 'sent' ? new Date().toISOString() : null })
        .eq('id', id),
      'newsletter.markDelivery',
    )
  }

  async deliveryCounts(campaignId: string) {
    const counts = { pending: 0, sending: 0, sent: 0, failed: 0, skipped: 0 }
    await Promise.all(
      (Object.keys(counts) as (keyof typeof counts)[]).map(async (status) => {
        const { count, error } = await db().from('newsletter_deliveries').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', status)
        if (error) throw new Error(`[newsletter.counts] ${error.message}`)
        counts[status] = count ?? 0
      }),
    )
    return counts
  }

  async skipPending(campaignId: string) {
    unwrap(await db().from('newsletter_deliveries').update({ status: 'skipped' }).eq('campaign_id', campaignId).in('status', ['pending', 'sending']), 'newsletter.skipPending')
  }

  async isSuppressed(email: string) {
    const data = unwrap(await db().from('newsletter_suppressions').select('email').eq('email', lower(email)).maybeSingle(), 'newsletter.isSuppressed')
    return Boolean(data)
  }

  async suppress(email: string, reason: string) {
    const e = lower(email)
    unwrap(await db().from('newsletter_suppressions').upsert({ email: e, reason }, { onConflict: 'email', ignoreDuplicates: true }), 'newsletter.suppress')
    unwrap(await db().from('newsletter_subscribers').update({ unsubscribed_at: new Date().toISOString() }).eq('email', e).is('unsubscribed_at', null), 'newsletter.unsubscribe')
    unwrap(await db().from('users').update({ marketing_opt_in: false }).eq('email', e), 'newsletter.optOut')
  }

  async resubscribe(email: string) {
    const e = lower(email)
    unwrap(await db().from('newsletter_suppressions').delete().eq('email', e), 'newsletter.resubscribe')
    unwrap(await db().from('newsletter_subscribers').update({ unsubscribed_at: null }).eq('email', e), 'newsletter.resubscribe')
  }

  async listSubscribers(): Promise<NewsletterSubscriberRow[]> {
    const rows = await fetchAll<Row>(
      (a, b) => db().from('newsletter_subscribers').select('id, email, source, created_at, unsubscribed_at').order('created_at', { ascending: false }).range(a, b),
      'newsletter.listSubscribers',
    )
    return rows.map((r) => ({
      id: String(r.id),
      email: String(r.email),
      source: (r.source as string) ?? null,
      created_at: String(r.created_at),
      unsubscribed_at: (r.unsubscribed_at as string) ?? null,
    }))
  }

  async deleteSubscriber(id: string) {
    unwrap(await db().from('newsletter_subscribers').delete().eq('id', id), 'newsletter.deleteSubscriber')
  }

  async setMarketingOptIn(userId: string, optIn: boolean) {
    unwrap(
      await db()
        .from('users')
        .update({ marketing_opt_in: optIn, marketing_opt_in_at: optIn ? new Date().toISOString() : null })
        .eq('id', userId),
      'newsletter.setOptIn',
    )
    if (optIn) {
      // Opting in again lifts a previous unsubscribe of that address.
      const user = unwrap(await db().from('users').select('email').eq('id', userId).maybeSingle(), 'newsletter.optInEmail')
      if (user?.email) unwrap(await db().from('newsletter_suppressions').delete().eq('email', lower(user.email)), 'newsletter.optInResub')
    }
  }

  async getMarketingOptIn(userId: string) {
    const data = unwrap(await db().from('users').select('marketing_opt_in').eq('id', userId).maybeSingle(), 'newsletter.getOptIn')
    return Boolean(data?.marketing_opt_in)
  }

  async verifyCronSecret(secret: string) {
    const { data, error } = await db().rpc('verify_cron_secret', { p_secret: secret })
    if (error) throw new Error(`[newsletter.verifyCronSecret] ${error.message}`)
    return data === true
  }

  async purchasedProductIds(recipient: { email: string; userId: string | null }) {
    const orderIds = new Set<string>()
    if (recipient.userId) {
      const rows = unwrap(await db().from('orders').select('id').eq('user_id', recipient.userId).limit(200), 'purchases.byUser') ?? []
      rows.forEach((r) => orderIds.add(String(r.id)))
    }
    const customers = unwrap(await db().from('customers').select('id').eq('email', lower(recipient.email)).limit(5), 'purchases.customers') ?? []
    if (customers.length > 0) {
      const rows = unwrap(await db().from('orders').select('id').in('customer_id', customers.map((c) => c.id)).limit(200), 'purchases.byCustomer') ?? []
      rows.forEach((r) => orderIds.add(String(r.id)))
    }
    if (orderIds.size === 0) return []
    const items = unwrap(await db().from('order_items').select('product_id, created_at').in('order_id', [...orderIds]).order('created_at', { ascending: false }).limit(200), 'purchases.items') ?? []
    return [...new Set(items.map((i) => i.product_id).filter(Boolean).map(String))]
  }
}
