import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'

/** Approved reviews of a piece and their summary. */
export const GET = route<{ slug: string }>(({ params }) => useCases.reviews.forProduct(params.slug), { cache: 'public, s-maxage=60, stale-while-revalidate=300' })
