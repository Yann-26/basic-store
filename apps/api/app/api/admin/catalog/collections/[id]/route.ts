import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { collectionSchema } from '@/interfaces/http/schemas'

type P = { id: string }

export const PUT = route<P>(
  async ({ params, body }) => useCases.catalog.updateCollection(params.id, await body(collectionSchema.partial())),
  { auth: 'admin' },
)

export const DELETE = route<P>(async ({ params }) => {
  await useCases.catalog.deleteCollection(params.id)
  return { success: true }
}, { auth: 'admin' })
