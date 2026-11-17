import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { mediaColorSchema } from '@/interfaces/http/schemas'

/** Sets the colour a photo shows (null: shared by every colour). */
export const PATCH = route<{ mediaId: string }>(
  async ({ params, body }) => useCases.products.setMediaColor(params.mediaId, (await body(mediaColorSchema)).color),
  { auth: 'admin', rateLimitKey: 'admin-media' },
)

export const DELETE = route<{ mediaId: string }>(async ({ params }) => {
  await useCases.products.deleteMedia(params.mediaId)
  return { success: true }
}, { auth: 'admin' })
