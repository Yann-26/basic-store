import { reviewAuthorName, summarizeReviews, type Order, type ProductReview, type ReviewStatus, type SessionUser } from '@trs/shared'
import type { Mailer, OrderRepository, ProductRepository, ReviewRepository } from '../ports'
import { ForbiddenError, NotFoundError, ValidationError } from '@/domain/errors'
import { adminNewReviewEmail, reviewInvitationEmail } from '../templates/emails'

export interface ReviewDeps {
  reviews: ReviewRepository
  orders: OrderRepository
  products: ProductRepository
  mailer: Mailer
  config: { appUrl: string; adminEmail?: string; supabaseUrl?: string }
}

export interface ReviewInput {
  product_id: string
  rating: number
  title?: string | null
  body?: string | null
  photo_url?: string | null
}

const NOT_ELIGIBLE = 'Seuls les clients dont la commande de cette pièce a été livrée peuvent donner leur avis.'

/** Reviews from customers whose order was delivered, shown once approved. */
export function makeReviewUseCases(d: ReviewDeps) {
  const shopUrl = d.config.appUrl.replace(/\/$/, '')

  /** The delivered order of this account that contains the piece, if any. */
  async function deliveredOrderWith(user: SessionUser, productId: string): Promise<Order | null> {
    const orders = await d.orders.listForAccount(user.id, user.email_verified ? user.email : null)
    return orders.find((o) => o.status === 'delivered' && (o.order_items ?? []).some((i) => i.product_id === productId)) ?? null
  }

  /** Only photos stored by the API in the reviews bucket are accepted. */
  function checkPhoto(url: string | null | undefined) {
    if (!url) return null
    const base = (d.config.supabaseUrl ?? '').replace(/\/$/, '')
    if (!base || !url.startsWith(`${base}/storage/v1/object/public/reviews/`)) throw new ValidationError('Photo invalide : envoyez-la depuis le formulaire.')
    return url
  }

  return {
    /** Product page: the approved reviews and their summary. */
    async forProduct(idOrSlug: string) {
      const product = await d.products.findByIdOrSlug(idOrSlug)
      if (!product) throw new NotFoundError('Pièce introuvable')
      const [ratings, reviews] = await Promise.all([d.reviews.approvedRatings(product.id), d.reviews.listApproved(product.id, 30)])
      return { summary: summarizeReviews(ratings), reviews: reviews.map(({ user_id: _u, order_id: _o, ...r }) => r) }
    },

    /** Whether the signed-in customer can review the piece, and their review if they already did. */
    async mine(user: SessionUser, productId: string) {
      const [existing, order] = await Promise.all([d.reviews.findByUserAndProduct(user.id, productId), deliveredOrderWith(user, productId)])
      return { can_review: !!order, review: existing }
    },

    /** Creates the review, or edits it (it then waits for approval again). */
    async submit(user: SessionUser, input: ReviewInput): Promise<ProductReview> {
      const rating = Math.round(input.rating)
      if (rating < 1 || rating > 5) throw new ValidationError('Note de 1 à 5 étoiles')
      const order = await deliveredOrderWith(user, input.product_id)
      if (!order) throw new ForbiddenError(NOT_ELIGIBLE)
      const content = {
        rating,
        title: (input.title ?? '').trim(),
        body: (input.body ?? '').trim(),
        photo_url: checkPhoto(input.photo_url),
      }
      const existing = await d.reviews.findByUserAndProduct(user.id, input.product_id)
      const review = existing
        ? await d.reviews.update(existing.id, { ...content, status: 'pending' })
        : await d.reviews.create({
            ...content,
            product_id: input.product_id,
            user_id: user.id,
            order_id: order.id,
            author_name: reviewAuthorName(user.first_name, user.last_name),
            status: 'pending',
          })
      if (d.config.adminEmail) {
        const name = order.order_items?.find((i) => i.product_id === input.product_id)?.product_name ?? 'Une pièce'
        void d.mailer.send({
          to: d.config.adminEmail,
          subject: `⭐ Nouvel avis à valider (${rating}/5)`,
          html: adminNewReviewEmail({ productName: name, rating, author: review.author_name, adminUrl: `${shopUrl}/admin/marketing?tab=avis` }),
        })
      }
      return review
    },

    /** Delivered: invite the customer to review each piece of the order. */
    async inviteAfterDelivery(order: Order) {
      const email = order.customers?.email
      if (!email) return false
      const ids = [...new Set((order.order_items ?? []).map((i) => i.product_id).filter((x): x is string => !!x))]
      const products = ids.length ? await d.products.findManyByIds(ids) : []
      const items = products.filter((p) => p.is_active).map((p) => ({ name: p.name, url: `${shopUrl}/product/${encodeURIComponent(p.slug)}#avis` }))
      if (items.length === 0) return false
      return d.mailer.send({
        to: email,
        subject: 'Votre avis sur vos pièces',
        html: reviewInvitationEmail({ firstName: order.customers?.first_name ?? '', items }),
      })
    },

    // ---------------------------------------------------------------- admin

    list(opts: { status?: ReviewStatus; page: number; limit: number }) {
      return d.reviews.list(opts)
    },

    async moderate(id: string, input: { status?: ReviewStatus; admin_reply?: string | null }) {
      const review = await d.reviews.findById(id)
      if (!review) throw new NotFoundError('Avis introuvable')
      const patch: { status?: ReviewStatus; admin_reply?: string | null } = {}
      if (input.status) patch.status = input.status
      if (input.admin_reply !== undefined) patch.admin_reply = input.admin_reply?.trim() || null
      return d.reviews.update(id, patch)
    },

    async remove(id: string) {
      const review = await d.reviews.findById(id)
      if (!review) throw new NotFoundError('Avis introuvable')
      await d.reviews.delete(id)
    },

    countPending() {
      return d.reviews.countPending()
    },
  }
}
