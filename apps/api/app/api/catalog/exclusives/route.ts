import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'

export const GET = route(() => useCases.catalog.listExclusives({ activeOnly: true }), {
  cache: 'public, s-maxage=30, stale-while-revalidate=60',
})
