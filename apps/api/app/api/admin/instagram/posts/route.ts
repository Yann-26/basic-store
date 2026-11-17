import { route, created } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { instagramPostSchema } from '@/interfaces/http/schemas'

export const GET = route(() => useCases.engagement.instagramPosts(), { auth: 'admin' })

export const POST = route(async ({ body }) => {
  const { hashtags, ...input } = await body(instagramPostSchema)
  const caption = hashtags ? `${input.caption ?? ''}\n\n${hashtags}`.trim() : input.caption
  return created(await useCases.engagement.createInstagramPost({ ...input, caption }))
}, { auth: 'admin' })
