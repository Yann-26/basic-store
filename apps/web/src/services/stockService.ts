import type { ManualStockReason, Product, StockMovement } from '@trs/shared'
import { http, toQuery } from '../core/http'

export type StockProduct = Product & { total_stock: number; low: boolean; out: boolean }

export interface StockPage {
  items: StockProduct[]
  total: number
  page: number
  totalPages: number
}

/** Back-office stock: on-hand quantities, low-stock alerts, movements and manual adjustments. */
export const stockService = {
  overview(params: { search?: string; low?: boolean; page?: number; limit?: number } = {}) {
    return http.get<StockPage>(`/admin/stock${toQuery({ search: params.search || undefined, low: params.low ? 'true' : undefined, page: params.page, limit: params.limit })}`)
  },
  movements(params: { productId?: string; page?: number; limit?: number } = {}) {
    return http.get<{ movements: StockMovement[]; total: number; page: number; totalPages: number }>(`/admin/stock/movements${toQuery(params)}`)
  },
  adjust(input: { product_id: string; size?: string | null; delta: number; reason: ManualStockReason; note?: string }) {
    return http.post<{ product: Product; size: string | null; quantity: number }>('/admin/stock/adjust', input)
  },
}
