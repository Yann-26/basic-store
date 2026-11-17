import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'

export const GET = route(
  ({ req }) => {
    // Home section shows a few looks; the lookbook page asks for more.
    const limit = Math.min(60, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 9))
    return useCases.engagement.instagramFeed(limit).catch(() => [])
  },
  { cache: 'public, s-maxage=300, stale-while-revalidate=600' },
)
