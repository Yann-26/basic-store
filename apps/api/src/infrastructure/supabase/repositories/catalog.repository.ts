import type { Brand, Collection } from '@trs/shared'
import type { BrandRepository, CollectionRepository } from '@/application/ports'
import { db, unwrap } from '../client'

type Row = Record<string, unknown>

function toCollection(row: Row): Collection {
  const { brands, ...rest } = row
  return { ...(rest as unknown as Collection), brand: (brands as Collection['brand']) ?? null }
}

export class SupabaseBrandRepository implements BrandRepository {
  async list(opts: { activeOnly?: boolean } = {}) {
    let query = db().from('brands').select('*').order('sort_order').order('name')
    if (opts.activeOnly) query = query.eq('is_active', true)
    return (unwrap(await query, 'brands.list') ?? []) as Brand[]
  }

  async findById(id: string) {
    return unwrap(await db().from('brands').select('*').eq('id', id).maybeSingle(), 'brands.findById') as Brand | null
  }

  async findBySlug(slug: string) {
    return unwrap(await db().from('brands').select('*').eq('slug', slug).maybeSingle(), 'brands.findBySlug') as Brand | null
  }

  async create(data: Omit<Brand, 'id' | 'created_at'>) {
    return unwrap(await db().from('brands').insert(data).select('*').single(), 'brands.create') as Brand
  }

  async update(id: string, data: Partial<Omit<Brand, 'id' | 'created_at'>>) {
    return unwrap(
      await db().from('brands').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select('*').single(),
      'brands.update',
    ) as Brand
  }

  async delete(id: string) {
    unwrap(await db().from('brands').delete().eq('id', id), 'brands.delete')
  }
}

export class SupabaseCollectionRepository implements CollectionRepository {
  private readonly select = '*, brands(id, name, slug)'

  async list(opts: { activeOnly?: boolean; brandId?: string } = {}) {
    let query = db().from('collections').select(this.select).order('sort_order').order('name')
    if (opts.activeOnly) query = query.eq('is_active', true)
    if (opts.brandId) query = query.eq('brand_id', opts.brandId)
    return ((unwrap(await query, 'collections.list') ?? []) as Row[]).map(toCollection)
  }

  async findById(id: string) {
    const row = unwrap(await db().from('collections').select(this.select).eq('id', id).maybeSingle(), 'collections.findById')
    return row ? toCollection(row as Row) : null
  }

  async findBySlug(slug: string) {
    const row = unwrap(await db().from('collections').select(this.select).eq('slug', slug).maybeSingle(), 'collections.findBySlug')
    return row ? toCollection(row as Row) : null
  }

  async countByBrand(brandId: string) {
    const { count } = await db().from('collections').select('id', { count: 'exact', head: true }).eq('brand_id', brandId)
    return count ?? 0
  }

  async create(data: Omit<Collection, 'id' | 'created_at' | 'brand'>) {
    return toCollection(unwrap(await db().from('collections').insert(data).select(this.select).single(), 'collections.create') as Row)
  }

  async update(id: string, data: Partial<Omit<Collection, 'id' | 'created_at' | 'brand'>>) {
    return toCollection(
      unwrap(
        await db().from('collections').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select(this.select).single(),
        'collections.update',
      ) as Row,
    )
  }

  async delete(id: string) {
    unwrap(await db().from('collections').delete().eq('id', id), 'collections.delete')
  }
}
