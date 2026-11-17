import { MANUAL_STOCK_REASONS, isLowStock, totalStock, type ManualStockReason, type SessionUser } from '@trs/shared'
import type { ProductRepository, StockRepository } from '../ports'
import { NotFoundError, ValidationError } from '@/domain/errors'

export interface StockDeps {
  stock: StockRepository
  products: ProductRepository
}

export interface StockAdjustInput {
  product_id: string
  /** The size moved; empty for a product sold as one size. */
  size?: string | null
  /** Units in (positive) or out (negative). */
  delta: number
  reason: ManualStockReason
  note?: string | null
}

/**
 * The shop's stock: what is on the shelves, what is running low, and every
 * movement (online orders, cancellations, returns, restocks, in-store sales,
 * inventory corrections). Orders move it by themselves; the back-office moves
 * it by hand through `adjust`, never by editing a product.
 */
export function makeStockUseCases(d: StockDeps) {
  return {
    async overview(opts: { search?: string; lowOnly?: boolean; page: number; limit: number }) {
      const page = await d.stock.overview(opts)
      return {
        ...page,
        page: opts.page,
        totalPages: Math.ceil(page.total / opts.limit),
        items: page.items.map((p) => ({ ...p, total_stock: totalStock(p), low: isLowStock(p), out: totalStock(p) <= 0 })),
      }
    },

    movements(opts: { productId?: string; page: number; limit: number }) {
      return d.stock.movements(opts)
    },

    /** Moves the stock of one size by hand (restock, in-store sale, correction). */
    async adjust(input: StockAdjustInput, admin: SessionUser) {
      if (!Number.isInteger(input.delta) || input.delta === 0) throw new ValidationError('Quantité invalide')
      if (!(MANUAL_STOCK_REASONS as readonly string[]).includes(input.reason)) throw new ValidationError('Motif invalide')
      if (input.reason === 'restock' && input.delta < 0) throw new ValidationError('Un réassort ajoute des pièces')
      if (input.reason === 'sale_in_store' && input.delta > 0) throw new ValidationError('Une vente en boutique retire des pièces')
      const product = await d.products.findByIdOrSlug(input.product_id, { includeInactive: true })
      if (!product) throw new NotFoundError('Produit introuvable')
      const size = product.sizes.length > 0 ? String(input.size ?? '').trim().toUpperCase() : null
      if (product.sizes.length > 0 && !product.sizes.includes(size ?? '')) throw new ValidationError('Choisissez une taille du produit')
      const quantity = await d.stock.adjust({ productId: product.id, size, delta: input.delta, reason: input.reason, note: input.note, adminId: admin.id })
      const updated = await d.products.findByIdOrSlug(product.id, { includeInactive: true })
      return { product: updated, size, quantity }
    },
  }
}
