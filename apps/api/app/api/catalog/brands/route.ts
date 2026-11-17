import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'

export const GET = route(() => useCases.catalog.listBrands({ activeOnly: true }), {
  cache: 'public, s-maxage=300, stale-while-revalidate=600',
})
