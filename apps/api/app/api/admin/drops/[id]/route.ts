import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { dropSchema } from '@/interfaces/http/schemas'

type P = { id: string }

export const PUT = route<P>(async ({ params, body }) => useCases.drops.update(params.id, await body(dropSchema.partial())), { auth: 'admin' })

export const DELETE = route<P>(async ({ params }) => {
  await useCases.drops.remove(params.id)
  return { success: true }
}, { auth: 'admin' })
