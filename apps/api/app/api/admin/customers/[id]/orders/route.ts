import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { uuidParam } from '@/interfaces/http/schemas'

export const GET = route<{ id: string }>(({ params }) => useCases.customers.orders(uuidParam.parse(params).id), { auth: 'admin' })
