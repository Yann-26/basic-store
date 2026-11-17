import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { stockMovementQuerySchema } from '@/interfaces/http/schemas'

/** Every stock movement, newest first (optionally for one product). */
export const GET = route(async ({ query }) => {
  const q = query(stockMovementQuerySchema)
  const { items, total } = await useCases.stock.movements(q)
  return { movements: items, total, page: q.page, totalPages: Math.ceil(total / q.limit) }
}, { auth: 'admin' })
