import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'

/** Products of the home page's 3D ring, in the order picked in the back-office. */
export const GET = route(() => useCases.catalog.showcase(), { cache: 'public, s-maxage=30, stale-while-revalidate=60' })
