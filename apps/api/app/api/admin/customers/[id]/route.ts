import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { customerUpdateSchema, uuidParam } from '@/interfaces/http/schemas'

type P = { id: string }

export const GET = route<P>(({ params }) => useCases.customers.get(uuidParam.parse(params).id), { auth: 'admin' })

export const PUT = route<P>(
  async ({ params, body }) => useCases.customers.update(uuidParam.parse(params).id, await body(customerUpdateSchema)),
  { auth: 'admin' },
)
