/**
 * Stock of the physical shop. A product either has sizes, each with its own
 * quantity (`size_stock`), or is sold as one size and uses `stock`.
 * `stock` is always kept equal to the sum of the sizes (the database does it).
 */
import { ONE_SIZE, normalizeSizes } from './catalog'

export const DEFAULT_LOW_STOCK_THRESHOLD = 3

export interface StockedProduct {
  stock: number
  sizes: string[]
  size_stock?: Record<string, number> | null
  low_stock_threshold?: number | null
  status?: string
}

/** Units on hand for one size ('TU' or empty for a product sold as one size). */
export function stockForSize(product: StockedProduct, size?: string | null): number {
  const sizes = normalizeSizes(product.sizes)
  if (sizes.length === 0) return Math.max(0, Math.floor(Number(product.stock) || 0))
  const key = String(size ?? '').trim().toUpperCase()
  if (!key || key === ONE_SIZE) return 0
  return Math.max(0, Math.floor(Number(product.size_stock?.[key]) || 0))
}

/** Units on hand across every size. */
export function totalStock(product: StockedProduct): number {
  const sizes = normalizeSizes(product.sizes)
  if (sizes.length === 0) return stockForSize(product)
  return sizes.reduce((sum, s) => sum + stockForSize(product, s), 0)
}

export function isOutOfStock(product: StockedProduct): boolean {
  return product.status === 'unavailable' || totalStock(product) <= 0
}

export function isLowStock(product: StockedProduct): boolean {
  const total = totalStock(product)
  const threshold = product.low_stock_threshold ?? DEFAULT_LOW_STOCK_THRESHOLD
  return total > 0 && total <= threshold
}

/**
 * Cleans a size → quantity map typed in the back-office: only the product's sizes,
 * whole numbers ≥ 0, every size present (missing ones count as 0).
 */
export function normalizeSizeStock(sizes: readonly string[], raw: unknown): Record<string, number> {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const upper = new Map(Object.entries(source).map(([k, v]) => [k.trim().toUpperCase(), v]))
  const out: Record<string, number> = {}
  for (const size of normalizeSizes([...sizes])) {
    const n = Math.floor(Number(upper.get(size)) || 0)
    out[size] = Math.max(0, Math.min(100_000, n))
  }
  return out
}

/** Why the stock of a product moved (stock_movements.reason). */
export const STOCK_MOVEMENT_REASONS = ['order', 'cancel', 'return', 'restock', 'adjustment', 'sale_in_store'] as const
export type StockMovementReason = (typeof STOCK_MOVEMENT_REASONS)[number]

/** Reasons an admin can pick when moving stock by hand. */
export const MANUAL_STOCK_REASONS = ['restock', 'adjustment', 'sale_in_store'] as const satisfies readonly StockMovementReason[]
export type ManualStockReason = (typeof MANUAL_STOCK_REASONS)[number]

export const STOCK_MOVEMENT_LABELS: Record<StockMovementReason, string> = {
  order: 'Commande en ligne',
  cancel: 'Commande annulée',
  return: 'Retour client',
  restock: 'Réassort',
  adjustment: 'Correction d’inventaire',
  sale_in_store: 'Vente en boutique',
}

export interface StockMovement {
  id: string
  product_id: string | null
  product_name?: string
  size: string | null
  /** Positive: units in; negative: units out. */
  delta: number
  reason: StockMovementReason
  order_id?: string | null
  note?: string | null
  created_by?: string | null
  created_at: string
}
