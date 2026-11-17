import { route, created } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { exclusiveSchema } from '@/interfaces/http/schemas'

export const GET = route(() => useCases.catalog.listExclusives({ activeOnly: false }), { auth: 'admin' })

export const POST = route(async ({ body }) => created(await useCases.catalog.createExclusive(await body(exclusiveSchema))), {
  auth: 'admin',
})
