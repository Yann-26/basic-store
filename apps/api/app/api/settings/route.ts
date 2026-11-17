import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'

export const GET = route(() => useCases.settings.getPublic(), { cache: 'public, s-maxage=30, stale-while-revalidate=30' })
