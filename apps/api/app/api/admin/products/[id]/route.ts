import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { productUpdateSchema } from '@/interfaces/http/schemas'

type P = { id: string }

export const GET = route<P>(({ params }) => useCases.products.get(params.id), { auth: 'admin' })

export const PUT = route<P>(async ({ params, body }) => useCases.products.update(params.id, await body(productUpdateSchema)), {
  auth: 'admin',
  rateLimit: 60,
})

export const DELETE = route<P>(async ({ params }) => {
  const { deactivated } = await useCases.products.remove(params.id)
  return { success: true, deactivated, message: deactivated ? 'Produit archivé (il possède des commandes)' : 'Produit supprimé' }
}, { auth: 'admin', rateLimit: 20 })
