import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { reviewQuerySchema } from '@/interfaces/http/schemas'

export const GET = route(({ query }) => useCases.reviews.list(query(reviewQuerySchema)), { auth: 'admin' })
