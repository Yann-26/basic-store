import { shuffleBySeed, type ProductListQuery, type ProductMedia } from '@trs/shared'
import type { ProductRepository, ProductWrite } from '@/application/ports'
import { db, safeSearchTerm, unwrap } from '../client'
import { toProduct, toProductMedia } from '../mappers'

const PRODUCT_SELECT = '*, product_media(*), brands(id, name, slug), collections(id, name, slug)'
/** Most products a shuffled listing ranks (Supabase returns at most 1000 rows per request). */
const SHUFFLE_POOL = 1000

interface Refs {
  brandId?: string
  collectionId?: string
}

export class SupabaseProductRepository implements ProductRepository {
  async list(q: ProductListQuery & { includeInactive?: boolean }) {
    const limit = Math.min(100, Math.max(1, q.limit ?? 24))
    const offset = Math.max(0, q.offset ?? 0)

    if (q.sort === 'shuffle') return this.listShuffled(q, limit, offset)

    const refs = await this.resolveRefs(q)
    if (!refs) return { items: [], total: 0 }
    let query = this.applyFilters(db().from('products').select(PRODUCT_SELECT, { count: 'exact' }), q, refs)

    switch (q.sort) {
      case 'price_asc': query = query.order('price', { ascending: true }); break
      case 'price_desc': query = query.order('price', { ascending: false }); break
      case 'name': query = query.order('name', { ascending: true }); break
      case 'oldest': query = query.order('created_at', { ascending: true }); break
      default: query = query.order('created_at', { ascending: false })
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1)
    unwrap({ data, error }, 'products.list')
    return { items: (data ?? []).map(toProduct), total: count ?? 0 }
  }

  /**
   * Random order, stable for a seed: every matching id is ranked by a seeded
   * hash, then only the requested page is loaded. Without a seed the order
   * changes every hour, so paging stays consistent in the meantime.
   */
  private async listShuffled(q: ProductListQuery & { includeInactive?: boolean }, limit: number, offset: number) {
    const refs = await this.resolveRefs(q)
    if (!refs) return { items: [], total: 0 }
    const query = this.applyFilters(db().from('products').select('id'), q, refs)
    const rows = unwrap(await query.range(0, SHUFFLE_POOL - 1), 'products.shuffle') ?? []

    const seed = q.seed ?? Math.floor(Date.now() / 3_600_000)
    const pageIds = shuffleBySeed(rows, (r) => r.id, seed).slice(offset, offset + limit).map((r) => r.id)
    const byId = new Map((await this.findManyByIds(pageIds)).map((p) => [p.id, p]))
    return { items: pageIds.map((id) => byId.get(id)).filter((p) => p !== undefined), total: rows.length }
  }

  /** Resolves brand/collection slugs to ids; null when one of them matches nothing. */
  private async resolveRefs(q: ProductListQuery): Promise<Refs | null> {
    const refs: Refs = {}
    if (q.brand) {
      const { data: brand } = await db().from('brands').select('id').eq('slug', q.brand).maybeSingle()
      if (!brand) return null
      refs.brandId = brand.id
    }
    if (q.collection) {
      const { data: col } = await db().from('collections').select('id').eq('slug', q.collection).maybeSingle()
      if (!col) return null
      refs.collectionId = col.id
    }
    return refs
  }

  /**
   * Applies the catalogue filters. Kept synchronous on purpose: query builders
   * are thenables, so returning one from an async function would run it.
   */
  private applyFilters<Q>(builder: Q, q: ProductListQuery & { includeInactive?: boolean }, refs: Refs): Q {
    // Same chainable filter API whatever the selected columns; typed loosely here only.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = builder as any
    if (!q.includeInactive) query = query.eq('is_active', true)
    if (q.category) query = query.eq('category', q.category)
    if (q.subcategory) query = query.ilike('subcategory', safeSearchTerm(q.subcategory))
    if (q.gender) {
      // Unisex items belong to both the men and women selections.
      query = q.gender === 'men' || q.gender === 'women'
        ? query.in('gender', [q.gender, 'unisex'])
        : query.eq('gender', q.gender)
    }
    if (refs.brandId) query = query.eq('brand_id', refs.brandId)
    if (refs.collectionId) query = query.eq('collection_id', refs.collectionId)
    if (q.search) {
      const term = safeSearchTerm(q.search)
      if (term) query = query.or(`name.ilike.%${term}%,subcategory.ilike.%${term}%,description.ilike.%${term}%`)
    }
    if (q.minPrice != null) query = query.gte('price', q.minPrice)
    if (q.maxPrice != null) query = query.lte('price', q.maxPrice)
    if (q.size) query = query.contains('sizes', [q.size])
    if (q.featured) query = query.eq('is_featured', true)
    return query as Q
  }

  async findByIdOrSlug(idOrSlug: string, opts: { includeInactive?: boolean } = {}) {
    const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug)
    let query = db().from('products').select(PRODUCT_SELECT).eq(isUuid ? 'id' : 'slug', idOrSlug)
    if (!opts.includeInactive) query = query.eq('is_active', true)
    const data = unwrap(await query.limit(1), 'products.find')
    return data?.[0] ? toProduct(data[0]) : null
  }

  async findManyByIds(ids: string[]) {
    if (ids.length === 0) return []
    const data = unwrap(await db().from('products').select(PRODUCT_SELECT).in('id', ids), 'products.findMany')
    return (data ?? []).map(toProduct)
  }

  async slugExists(slug: string, exceptId?: string) {
    let query = db().from('products').select('id').eq('slug', slug)
    if (exceptId) query = query.neq('id', exceptId)
    const data = unwrap(await query.limit(1), 'products.slugExists')
    return (data ?? []).length > 0
  }

  async create(data: ProductWrite) {
    const row = unwrap(await db().from('products').insert(data).select(PRODUCT_SELECT).single(), 'products.create')
    return toProduct(row)
  }

  async update(id: string, data: Partial<ProductWrite>) {
    const row = unwrap(
      await db().from('products').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select(PRODUCT_SELECT).single(),
      'products.update',
    )
    return toProduct(row)
  }

  async delete(id: string) {
    unwrap(await db().from('product_media').delete().eq('product_id', id), 'products.deleteMedia')
    unwrap(await db().from('products').delete().eq('id', id), 'products.delete')
  }

  async hasOrders(id: string) {
    const { count } = await db().from('order_items').select('id', { count: 'exact', head: true }).eq('product_id', id)
    return (count ?? 0) > 0
  }

  async countByBrand(brandId: string) {
    const { count } = await db().from('products').select('id', { count: 'exact', head: true }).eq('brand_id', brandId)
    return count ?? 0
  }

  async countByCollection(collectionId: string) {
    const { count } = await db().from('products').select('id', { count: 'exact', head: true }).eq('collection_id', collectionId)
    return count ?? 0
  }

  async findMedia(mediaId: string) {
    const data = unwrap(await db().from('product_media').select('*').eq('id', mediaId).maybeSingle(), 'media.find')
    return data ? toProductMedia(data) : null
  }

  async listMedia(productId: string) {
    const data = unwrap(await db().from('product_media').select('*').eq('product_id', productId), 'media.list')
    return (data ?? []).map(toProductMedia)
  }

  async addMedia(media: Omit<ProductMedia, 'id'> & { product_id: string; file_size?: number; mime_type?: string }) {
    const row = unwrap(await db().from('product_media').insert(media).select('*').single(), 'media.add')
    return toProductMedia(row)
  }

  async deleteMedia(mediaId: string) {
    unwrap(await db().from('product_media').delete().eq('id', mediaId), 'media.delete')
  }

  async setMediaColor(mediaId: string, color: string | null) {
    unwrap(await db().from('product_media').update({ color }).eq('id', mediaId), 'media.setColor')
  }

  async setMainMedia(productId: string, mediaId: string) {
    unwrap(await db().from('product_media').update({ is_main: false }).eq('product_id', productId), 'media.unsetMain')
    unwrap(await db().from('product_media').update({ is_main: true }).eq('id', mediaId).eq('product_id', productId), 'media.setMain')
  }
}

