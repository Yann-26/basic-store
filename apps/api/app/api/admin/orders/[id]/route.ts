import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { updateOrderSchema, uuidParam } from '@/interfaces/http/schemas'

type P = { id: string }

export const GET = route<P>(({ params }) => useCases.orders.get(uuidParam.parse(params).id), { auth: 'admin' })

export const PUT = route<P>(async ({ params, body }) => {
  const { adminNotes, notes, ...input } = await body(updateOrderSchema)
  return useCases.orders.update(uuidParam.parse(params).id, { ...input, admin_notes: input.admin_notes ?? adminNotes ?? notes })
}, { auth: 'admin', rateLimit: 60 })

export const DELETE = route<P>(async ({ params }) => {
  await useCases.orders.remove(uuidParam.parse(params).id)
  return { success: true }
}, { auth: 'admin', rateLimit: 10 })
