import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'

export const GET = route(
  ({ req }) => useCases.catalog.listCollections({ activeOnly: true, brandSlug: req.nextUrl.searchParams.get('brand') ?? undefined }),
  { cache: 'public, s-maxage=60, stale-while-revalidate=120' },
)
