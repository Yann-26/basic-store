import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { productQuerySchema } from '@/interfaces/http/schemas'

export const GET = route(
  async ({ query }) => {
    const { status: _legacy, ...q } = query(productQuerySchema)
    return useCases.catalog.listProducts(q)
  },
  { cache: 'public, s-maxage=30, stale-while-revalidate=120' },
)
