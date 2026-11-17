import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { paymentQuerySchema } from '@/interfaces/http/schemas'

export const GET = route(({ query }) => useCases.payments.list(query(paymentQuerySchema)), { auth: 'admin' })
