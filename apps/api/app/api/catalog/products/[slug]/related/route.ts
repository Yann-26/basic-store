import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'

export const GET = route<{ slug: string }>(({ params }) => useCases.catalog.relatedProducts(params.slug), {
  cache: 'public, s-maxage=60, stale-while-revalidate=300',
})
