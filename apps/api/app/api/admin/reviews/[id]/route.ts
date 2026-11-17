import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { reviewModerationSchema } from '@/interfaces/http/schemas'

type P = { id: string }

export const PUT = route<P>(async ({ params, body }) => useCases.reviews.moderate(params.id, await body(reviewModerationSchema)), { auth: 'admin' })

export const DELETE = route<P>(async ({ params }) => {
  await useCases.reviews.remove(params.id)
  return { success: true }
}, { auth: 'admin' })
