import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { stockQuerySchema } from '@/interfaces/http/schemas'

/** Stock page: active products, lowest stock first (`low=true`: only the ones at or under their alert threshold). */
export const GET = route(async ({ query }) => {
  const q = query(stockQuerySchema)
  return useCases.stock.overview({ search: q.search, lowOnly: q.low, page: q.page, limit: q.limit })
}, { auth: 'admin' })
