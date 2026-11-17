import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'

export const PUT = route<{ id: string; mediaId: string }>(async ({ params }) => {
  await useCases.products.setMainMedia(params.id, params.mediaId)
  return { success: true }
}, { auth: 'admin' })
