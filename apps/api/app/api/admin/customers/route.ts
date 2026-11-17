import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'

export const GET = route(({ req }) => useCases.customers.list(req.nextUrl.searchParams.get('search') ?? undefined), { auth: 'admin' })
