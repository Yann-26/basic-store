import type { Product, StockMovement, StockMovementReason } from '@trs/shared'
import type { StockRepository } from '@/application/ports'
import { OutOfStockError, ValidationError } from '@/domain/errors'
import { db, safeSearchTerm, unwrap } from '../client'
import { toProduct } from '../mappers'

type Row = Record<string, unknown>

const PRODUCT_SELECT = '*, product_media(*), brands(id, name, slug), collections(id, name, slug)'

function toMovement(row: Row): StockMovement {
  return {
    id: String(row.id),
    product_id: row.product_id == null ? null : String(row.product_id),
    product_name: String(row.product_name ?? ''),
    size: (row.size as string) ?? null,
    delta: Number(row.delta) || 0,
    reason: row.reason as StockMovementReason,
    order_id: (row.order_id as string) ?? null,
    note: (row.note as string) ?? null,
    created_by: (row.created_by as string) ?? null,
    created_at: String(row.created_at),
  }
}

export class SupabaseStockRepository implements StockRepository {
  async adjust(input: Parameters<StockRepository['adjust']>[0]) {
    const { data, error } = await db().rpc('adjust_stock', {
      p_product_id: input.productId,
      p_size: input.size ?? '',
      p_delta: input.delta,
      p_reason: input.reason,
      p_note: input.note ?? null,
      p_admin: input.adminId,
    })
    if (error) {
      const out = OutOfStockError.fromDatabase(error.message)
      if (out) throw out
      if (/UNKNOWN_SIZE/.test(error.message)) throw new ValidationError('Cette taille n’existe pas pour ce produit')
      if (/PRODUCT_NOT_FOUND/.test(error.message)) throw new ValidationError('Produit introuvable')
      throw new Error(`[stock.adjust] ${error.message}`)
    }
    return Number(data) || 0
  }

  async movements(opts: { productId?: string; page: number; limit: number }) {
    let query = db()
      .from('stock_movements')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((opts.page - 1) * opts.limit, opts.page * opts.limit - 1)
    if (opts.productId) query = query.eq('product_id', opts.productId)
    const { data, error, count } = await query
    unwrap({ data, error }, 'stock.movements')
    return { items: (data ?? []).map((r) => toMovement(r as Row)), total: count ?? 0 }
  }

  async overview(opts: { search?: string; lowOnly?: boolean; page: number; limit: number }) {
    let query = db()
      .from('products')
      .select(PRODUCT_SELECT, { count: 'exact' })
      .eq('is_active', true)
      .order('stock', { ascending: true })
      .order('name', { ascending: true })
    if (opts.search) {
      const term = safeSearchTerm(opts.search)
      if (term) query = query.ilike('name', `%${term}%`)
    }
    if (opts.lowOnly) {
      // The threshold is per product: filter the low ones after reading the lowest stocks.
      const rows = unwrap(await query.lte('stock', 1000).range(0, 999), 'stock.low') ?? []
      const low = (rows as Row[]).map(toProduct).filter((p: Product) => p.stock <= (p.low_stock_threshold ?? 3))
      const start = (opts.page - 1) * opts.limit
      return { items: low.slice(start, start + opts.limit), total: low.length }
    }
    const { data, error, count } = await query.range((opts.page - 1) * opts.limit, opts.page * opts.limit - 1)
    unwrap({ data, error }, 'stock.overview')
    return { items: (data ?? []).map((r) => toProduct(r as Row)), total: count ?? 0 }
  }
}
