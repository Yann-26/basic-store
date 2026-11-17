import { NEWSLETTER_MAX_PRODUCTS, type NewsletterBlock, type NewsletterCampaign, type Product, type SessionUser } from '@trs/shared'
import { brand } from '../brand'
import type {
  Mailer,
  NewsletterCampaignWrite,
  NewsletterRecipient,
  NewsletterRepository,
  ProductRepository,
  PurchaseHistoryRepository,
  UnsubscribeTokens,
} from '../ports'
import { renderNewsletter } from '../templates/newsletter'
import { recommend } from '../recommendations'
import { ConflictError, NotFoundError, ValidationError } from '@/domain/errors'

export interface NewsletterDeps {
  newsletter: NewsletterRepository
  purchases: PurchaseHistoryRepository
  products: ProductRepository
  mailer: Mailer
  unsubscribe: UnsubscribeTokens
  config: { appUrl: string }
  /** Clock and pause between emails (injectable for tests). */
  now?: () => Date
  pause?: (ms: number) => Promise<void>
}

const BATCH = 25
const TIME_BUDGET_MS = 45_000
const PAUSE_MS = 250 // gentle on Gmail's SMTP limits
const MAX_SCHEDULE_DAYS = 366
const EDITABLE: NewsletterCampaign['status'][] = ['draft', 'scheduled', 'cancelled']
/** Campaigns made by the shop when a piece is published carry this title. */
export const NEW_PRODUCTS_TITLE = 'Nouveautés (envoi automatique)'
/**
 * The email leaves a while after the piece is published: its photos are added
 * right after it is created, and pieces published together share one email.
 */
export const ANNOUNCE_DELAY_MS = 15 * 60_000
const productIdsOf = (c: Pick<NewsletterCampaign, 'blocks'>) => c.blocks.flatMap((b) => (b.type === 'products' ? b.productIds : []))

/** Campaigns designed in the back-office, sent now or at a scheduled time, with personalised picks. */
export function makeNewsletterUseCases(d: NewsletterDeps) {
  const now = d.now ?? (() => new Date())
  const pause = d.pause ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  const base = d.config.appUrl.replace(/\/$/, '')

  function unsubscribeUrl(email: string) {
    const q = new URLSearchParams({ e: email, t: d.unsubscribe.sign(email) })
    return { page: `${base}/desinscription?${q}`, oneClick: `${base}/api/newsletter/unsubscribe?${q}` }
  }

  async function loadProducts(blocks: NewsletterBlock[]) {
    const ids = [...new Set(blocks.flatMap((b) => (b.type === 'products' ? b.productIds : [])))]
    return new Map((await d.products.findManyByIds(ids)).map((p) => [p.id, p]))
  }

  /** Catalogue used for recommendations, loaded once per run. */
  function catalogLoader() {
    let catalog: Promise<Product[]> | null = null
    return () => (catalog ??= d.products.list({ sort: 'newest', limit: 100 }).then((r) => r.items))
  }

  async function recommendationsFor(recipient: Pick<NewsletterRecipient, 'email' | 'userId'>, blocks: NewsletterBlock[], catalog: () => Promise<Product[]>) {
    if (!blocks.some((b) => b.type === 'recommendations')) return []
    const ids = await d.purchases.purchasedProductIds(recipient)
    const purchased = ids.length ? await d.products.findManyByIds(ids) : []
    return recommend(purchased, await catalog())
  }

  async function render(campaign: Pick<NewsletterCampaign, 'subject' | 'preheader' | 'blocks'>, recipient: NewsletterRecipient, ctx: { products: Map<string, Product>; catalog: () => Promise<Product[]> }) {
    const links = unsubscribeUrl(recipient.email)
    const html = renderNewsletter({
      subject: campaign.subject,
      preheader: campaign.preheader,
      blocks: campaign.blocks,
      products: ctx.products,
      recommendations: await recommendationsFor(recipient, campaign.blocks, ctx.catalog),
      firstName: recipient.firstName,
      appUrl: base,
      unsubscribeUrl: links.page,
    })
    return { html, headers: { 'List-Unsubscribe': `<${links.oneClick}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } }
  }

  async function getOr404(id: string) {
    const c = await d.newsletter.get(id)
    if (!c) throw new NotFoundError('Campagne introuvable')
    return c
  }

  /** Sends one batch of a campaign being sent; finishes it when nothing is left. */
  async function work(campaign: NewsletterCampaign, deadline: number) {
    const ctx = { products: await loadProducts(campaign.blocks), catalog: catalogLoader() }
    while (Date.now() < deadline) {
      const batch = await d.newsletter.claim(campaign.id, BATCH)
      if (batch.length === 0) break
      for (const delivery of batch) {
        if (await d.newsletter.isSuppressed(delivery.email)) {
          await d.newsletter.markDelivery(delivery.id, { status: 'skipped', error: 'Désinscrit' })
          continue
        }
        try {
          const { html, headers } = await render(campaign, { email: delivery.email, firstName: delivery.firstName, userId: delivery.userId }, ctx)
          const ok = await d.mailer.send({ to: delivery.email, subject: campaign.subject, html, headers })
          const error = ok ? null : (d.mailer.status().lastError ?? 'Envoi refusé')
          await d.newsletter.markDelivery(delivery.id, ok ? { status: 'sent' } : { status: 'failed', error })
        } catch (error) {
          await d.newsletter.markDelivery(delivery.id, { status: 'failed', error: error instanceof Error ? error.message.slice(0, 300) : 'Erreur' })
        }
        await pause(PAUSE_MS)
      }
    }
    const counts = await d.newsletter.deliveryCounts(campaign.id)
    const stats = { sent_count: counts.sent, failed_count: counts.failed }
    if (counts.pending + counts.sending > 0) {
      await d.newsletter.transition(campaign.id, ['sending'], 'sending', stats)
      return { campaign: campaign.id, done: false, ...counts }
    }
    const allFailed = counts.sent === 0 && counts.failed > 0
    await d.newsletter.transition(campaign.id, ['sending'], allFailed ? 'failed' : 'sent', { ...stats, finished_at: now().toISOString() })
    return { campaign: campaign.id, done: true, ...counts }
  }

  return {
    list: () => d.newsletter.list(),
    get: getOr404,
    audienceCounts: () => d.newsletter.countAudience(),

    create(admin: SessionUser, input: NewsletterCampaignWrite) {
      return d.newsletter.create({ ...input, created_by: admin.id })
    },

    async update(id: string, input: Partial<NewsletterCampaignWrite>) {
      const c = await getOr404(id)
      if (!EDITABLE.includes(c.status)) throw new ConflictError('Une campagne envoyée ou en cours d’envoi ne peut plus être modifiée')
      return d.newsletter.update(id, input)
    },

    async remove(id: string) {
      const c = await getOr404(id)
      if (c.status === 'sending') throw new ConflictError('Annulez d’abord l’envoi en cours')
      await d.newsletter.delete(id)
    },

    /** HTML preview as the admin would receive it (their own recommendations). */
    async preview(admin: SessionUser, input: Pick<NewsletterCampaign, 'subject' | 'preheader' | 'blocks'>) {
      const ctx = { products: await loadProducts(input.blocks), catalog: catalogLoader() }
      const { html } = await render(input, { email: admin.email, firstName: admin.first_name, userId: admin.id }, ctx)
      return { html }
    },

    async sendTest(admin: SessionUser, id: string) {
      const c = await getOr404(id)
      const ctx = { products: await loadProducts(c.blocks), catalog: catalogLoader() }
      const { html, headers } = await render(c, { email: admin.email, firstName: admin.first_name, userId: admin.id }, ctx)
      const sent = await d.mailer.send({ to: admin.email, subject: `[Test] ${c.subject}`, html, headers })
      return { sent, to: admin.email, error: sent ? null : (d.mailer.status().lastError ?? 'Envoi refusé') }
    },

    async schedule(id: string, at: Date) {
      const c = await getOr404(id)
      if (c.blocks.length === 0) throw new ValidationError('La campagne est vide')
      const t = now().getTime()
      if (at.getTime() < t - 60_000) throw new ValidationError('Choisissez une date dans le futur')
      if (at.getTime() > t + MAX_SCHEDULE_DAYS * 86_400_000) throw new ValidationError('Date trop lointaine')
      const updated = await d.newsletter.transition(c.id, ['draft', 'scheduled', 'cancelled'], 'scheduled', { scheduled_at: at.toISOString() })
      if (!updated) throw new ConflictError('Cette campagne ne peut plus être programmée')
      return updated
    },

    /** "Envoyer maintenant": scheduled for now; the first batch leaves right away. */
    async sendNow(id: string) {
      const scheduled = await this.schedule(id, now())
      return scheduled
    },

    async cancel(id: string) {
      const c = await getOr404(id)
      const updated = await d.newsletter.transition(c.id, ['scheduled', 'sending'], 'cancelled')
      if (!updated) throw new ConflictError('Cette campagne n’est ni programmée ni en cours d’envoi')
      await d.newsletter.skipPending(c.id)
      const counts = await d.newsletter.deliveryCounts(c.id)
      return (await d.newsletter.transition(c.id, ['cancelled'], 'cancelled', { sent_count: counts.sent, failed_count: counts.failed })) ?? updated
    },

    /**
     * The worker (cron every few minutes, and right after "Envoyer maintenant"):
     * starts due campaigns (builds their recipient list once) and sends batches
     * within a time budget. Safe to run concurrently and repeatedly.
     */
    async processDue() {
      const deadline = Date.now() + TIME_BUDGET_MS
      const results = []
      for (const due of await d.newsletter.due(now())) {
        let campaign: NewsletterCampaign | null = due
        if (due.status === 'scheduled') {
          campaign = await d.newsletter.transition(due.id, ['scheduled'], 'sending', { started_at: now().toISOString() })
          if (!campaign) continue // another worker started it
          const recipients = await d.newsletter.audience(campaign.audience)
          const total = await d.newsletter.enqueue(campaign.id, recipients)
          campaign = (await d.newsletter.transition(campaign.id, ['sending'], 'sending', { recipients_count: total })) ?? campaign
        }
        if (Date.now() >= deadline) break
        results.push(await work(campaign, deadline))
      }
      return { processed: results }
    },

    /** Scheduler authentication: CRON_SECRET (Vercel cron) or the database-held secret (pg_cron). */
    async isSchedulerCall(token: string, envSecret: string | undefined) {
      if (!token) return false
      if (envSecret && token.length === envSecret.length) {
        const { timingSafeEqual } = await import('node:crypto')
        if (timingSafeEqual(Buffer.from(token), Buffer.from(envSecret))) return true
      }
      return token.length >= 32 && token.length <= 200 && (await d.newsletter.verifyCronSecret(token))
    },

    /** One-click unsubscribe from a signed link. */
    async unsubscribe(email: string, token: string) {
      const e = email.trim().toLowerCase()
      if (!e || !token || !d.unsubscribe.verify(e, token)) throw new ValidationError('Lien de désinscription invalide')
      await d.newsletter.suppress(e, 'unsubscribed')
      return { unsubscribed: true, email: e }
    },

    /**
     * A piece was published: the subscribers get a "nouveauté" email, sent by the
     * usual campaign worker (consent, one-click unsubscribe, throttling and the
     * statistics of the Newsletter page all apply). Pieces published within the
     * delay join the same email; a piece is never announced twice.
     */
    async announceProduct(product: Pick<Product, 'id' | 'name' | 'is_active'>) {
      if (!product.is_active) return { queued: false as const, reason: 'inactive' as const }
      const auto = (await d.newsletter.list()).filter((c) => c.title === NEW_PRODUCTS_TITLE && c.status !== 'cancelled' && c.status !== 'failed')
      if (auto.some((c) => productIdsOf(c).includes(product.id))) return { queued: false as const, reason: 'already' as const }

      const t = now().getTime()
      // Still waiting for its send time (with a margin so the worker cannot be starting it right now).
      const open = auto.find(
        (c) => c.status === 'scheduled' && c.scheduled_at && new Date(c.scheduled_at).getTime() > t + 60_000 && productIdsOf(c).length < NEWSLETTER_MAX_PRODUCTS,
      )
      if (open) {
        const blocks = open.blocks.map((b) => (b.type === 'products' ? { ...b, productIds: [...b.productIds, product.id] } : b))
        await d.newsletter.update(open.id, { blocks, subject: `Nouveautés chez ${brand().name}` })
        return { queued: true as const, campaign: open.id, joined: true }
      }

      const blocks: NewsletterBlock[] = [
        { id: 'new-heading', type: 'heading', text: `Nouveau chez ${brand().name}` },
        { id: 'new-text', type: 'text', text: 'Une nouvelle pièce vient d’arriver dans la boutique. Découvrez-la en premier.' },
        { id: 'new-products', type: 'products', productIds: [product.id] },
        { id: 'new-button', type: 'button', label: 'Découvrir la boutique', url: `${base}/collection` },
      ]
      const campaign = await d.newsletter.create({
        title: NEW_PRODUCTS_TITLE,
        subject: `Nouveau : ${product.name}`.slice(0, 150),
        preheader: 'Une nouvelle pièce est disponible.',
        blocks,
        audience: 'all',
        created_by: null,
      })
      await d.newsletter.transition(campaign.id, ['draft'], 'scheduled', { scheduled_at: new Date(t + ANNOUNCE_DELAY_MS).toISOString() })
      return { queued: true as const, campaign: campaign.id, joined: false }
    },

    listSubscribers: () => d.newsletter.listSubscribers(),
    deleteSubscriber: (id: string) => d.newsletter.deleteSubscriber(id),
    getPreferences: async (user: SessionUser) => ({ marketingOptIn: await d.newsletter.getMarketingOptIn(user.id) }),
    async setPreferences(user: SessionUser, input: { marketingOptIn: boolean }) {
      await d.newsletter.setMarketingOptIn(user.id, input.marketingOptIn)
      return { marketingOptIn: input.marketingOptIn }
    },
  }
}
