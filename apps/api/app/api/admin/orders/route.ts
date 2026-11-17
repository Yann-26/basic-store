import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { orderQuerySchema } from '@/interfaces/http/schemas'

export const GET = route(async ({ query }) => {
  const q = query(orderQuerySchema)
  const { items, total } = await useCases.orders.list(q)
  return { orders: items, total, page: q.page, totalPages: Math.ceil(total / q.limit) }
}, { auth: 'admin' })
