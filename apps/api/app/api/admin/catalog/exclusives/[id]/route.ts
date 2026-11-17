import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { exclusiveSchema } from '@/interfaces/http/schemas'

type P = { id: string }

export const PUT = route<P>(
  async ({ params, body }) => useCases.catalog.updateExclusive(params.id, await body(exclusiveSchema.partial())),
  { auth: 'admin' },
)

export const DELETE = route<P>(async ({ params }) => {
  await useCases.catalog.deleteExclusive(params.id)
  return { success: true }
}, { auth: 'admin' })
