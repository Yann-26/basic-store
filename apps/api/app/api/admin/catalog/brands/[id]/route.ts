import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { brandSchema } from '@/interfaces/http/schemas'

type P = { id: string }

export const PUT = route<P>(async ({ params, body }) => useCases.catalog.updateBrand(params.id, await body(brandSchema.partial())), {
  auth: 'admin',
})

export const DELETE = route<P>(async ({ params }) => {
  await useCases.catalog.deleteBrand(params.id)
  return { success: true }
}, { auth: 'admin' })
