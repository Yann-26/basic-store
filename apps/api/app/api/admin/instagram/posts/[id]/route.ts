import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { instagramPostSchema, uuidParam } from '@/interfaces/http/schemas'

type P = { id: string }

export const PUT = route<P>(async ({ params, body }) => {
  const { hashtags: _h, ...patch } = await body(instagramPostSchema.partial())
  await useCases.engagement.updateInstagramPost(uuidParam.parse(params).id, patch)
  return { success: true }
}, { auth: 'admin' })

export const DELETE = route<P>(async ({ params }) => {
  await useCases.engagement.deleteInstagramPost(uuidParam.parse(params).id)
  return { success: true }
}, { auth: 'admin' })
