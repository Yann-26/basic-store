import type { ProductReview, ReviewStatus } from '@trs/shared'
import type { ReviewRepository, ReviewWrite } from '@/application/ports'
import { db, unwrap } from '../client'

type Row = Record<string, unknown>
const PUBLIC = 'id, product_id, author_name, rating, title, body, photo_url, status, admin_reply, created_at'

function toReview(row: Row): ProductReview {
  const { products, ...rest } = row
  return { ...(rest as unknown as ProductReview), rating: Number(row.rating) || 0, product: (products as ProductReview['product']) ?? undefined }
}

export class SupabaseReviewRepository implements ReviewRepository {
  async listApproved(productId: string, limit: number) {
    const rows = unwrap(
      await db().from('product_reviews').select(PUBLIC).eq('product_id', productId).eq('status', 'approved').order('created_at', { ascending: false }).limit(limit),
      'reviews.listApproved',
    )
    return ((rows ?? []) as Row[]).map(toReview)
  }

  async approvedRatings(productId: string) {
    const rows = unwrap(await db().from('product_reviews').select('rating').eq('product_id', productId).eq('status', 'approved').limit(5000), 'reviews.ratings')
    return ((rows ?? []) as { rating: number }[]).map((r) => Number(r.rating))
  }

  async list(opts: { status?: ReviewStatus; page: number; limit: number }) {
    const from = (opts.page - 1) * opts.limit
    let query = db()
      .from('product_reviews')
      .select('*, products(id, name, slug)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + opts.limit - 1)
    if (opts.status) query = query.eq('status', opts.status)
    const { data, error, count } = await query
    if (error) throw new Error(`[reviews.list] ${error.message}`)
    return { items: ((data ?? []) as Row[]).map(toReview), total: count ?? 0 }
  }

  async findById(id: string) {
    const row = unwrap(await db().from('product_reviews').select('*').eq('id', id).maybeSingle(), 'reviews.findById')
    return row ? toReview(row as Row) : null
  }

  async findByUserAndProduct(userId: string, productId: string) {
    const row = unwrap(await db().from('product_reviews').select('*').eq('user_id', userId).eq('product_id', productId).maybeSingle(), 'reviews.findMine')
    return row ? toReview(row as Row) : null
  }

  async create(data: ReviewWrite) {
    return toReview(unwrap(await db().from('product_reviews').insert(data).select('*').single(), 'reviews.create') as Row)
  }

  async update(id: string, patch: Partial<Pick<ProductReview, 'status' | 'admin_reply' | 'rating' | 'title' | 'body' | 'photo_url'>>) {
    return toReview(
      unwrap(await db().from('product_reviews').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select('*').single(), 'reviews.update') as Row,
    )
  }

  async delete(id: string) {
    unwrap(await db().from('product_reviews').delete().eq('id', id), 'reviews.delete')
  }

  async countPending() {
    const { count, error } = await db().from('product_reviews').select('id', { count: 'exact', head: true }).eq('status', 'pending')
    if (error) throw new Error(`[reviews.countPending] ${error.message}`)
    return count ?? 0
  }
}
