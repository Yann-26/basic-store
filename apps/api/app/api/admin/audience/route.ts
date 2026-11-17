import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { audienceQuerySchema } from '@/interfaces/http/schemas'

export const GET = route(({ query }) => useCases.audience.stats(query(audienceQuerySchema).range), { auth: 'admin', rateLimit: 60 })
