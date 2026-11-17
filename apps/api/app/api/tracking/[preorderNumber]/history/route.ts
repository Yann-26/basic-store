import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'

export const GET = route<{ preorderNumber: string }>(({ params }) => useCases.orders.history(params.preorderNumber), { rateLimit: 30, rateLimitKey: 'tracking-history' })
