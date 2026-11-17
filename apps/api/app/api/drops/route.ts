import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'

/** The drop calendar: published drops, with their pieces. */
export const GET = route(() => useCases.drops.calendar(), { cache: 'public, s-maxage=60, stale-while-revalidate=300' })
