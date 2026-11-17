import { route, created } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { productCreateSchema, productQuerySchema } from '@/interfaces/http/schemas'

export const GET = route(
  ({ query }) => {
    const { status: _legacy, ...q } = query(productQuerySchema)
    return useCases.products.list(q)
  },
  { auth: 'admin' },
)

export const POST = route(async ({ body }) => created(await useCases.products.create(await body(productCreateSchema))), {
  auth: 'admin',
  rateLimit: 30,
})
