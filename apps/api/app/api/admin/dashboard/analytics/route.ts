import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { analyticsQuerySchema } from '@/interfaces/http/schemas'

export const GET = route(({ query }) => useCases.dashboard.analytics(query(analyticsQuerySchema).days), { auth: 'admin', rateLimit: 30 })
