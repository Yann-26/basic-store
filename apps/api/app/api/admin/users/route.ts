import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { adminUserQuerySchema } from '@/interfaces/http/schemas'

/** Every account (customers who never ordered included), with filters and counts. */
export const GET = route(({ query }) => useCases.users.list(query(adminUserQuerySchema)), { auth: 'admin' })
