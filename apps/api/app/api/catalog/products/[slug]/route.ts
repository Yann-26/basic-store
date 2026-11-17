import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'

export const GET = route<{ slug: string }>(({ params }) => useCases.catalog.getProduct(params.slug), {
  cache: 'public, s-maxage=30, stale-while-revalidate=120',
})
