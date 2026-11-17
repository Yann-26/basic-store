import type { InstagramPost, InstagramRepository } from '@/application/ports'
import { db, unwrap } from '../client'

export class SupabaseInstagramRepository implements InstagramRepository {
  async list(opts: { publishedOnly: boolean; limit?: number }) {
    let query = db().from('instagram_posts').select('*').order('sort_order', { ascending: true }).order('posted_at', { ascending: false })
    if (opts.publishedOnly) query = query.eq('is_published', true)
    if (opts.limit) query = query.limit(opts.limit)
    return (unwrap(await query, 'instagram.list') ?? []) as InstagramPost[]
  }

  async create(post: Omit<InstagramPost, 'id'>) {
    return unwrap(await db().from('instagram_posts').insert(post).select('*').single(), 'instagram.create') as InstagramPost
  }

  async update(id: string, patch: Partial<Omit<InstagramPost, 'id'>>) {
    unwrap(
      await db().from('instagram_posts').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id),
      'instagram.update',
    )
  }

  async delete(id: string) {
    unwrap(await db().from('instagram_posts').delete().eq('id', id), 'instagram.delete')
  }
}
