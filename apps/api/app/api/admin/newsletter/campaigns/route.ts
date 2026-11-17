import { route, created } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { newsletterCampaignSchema } from '@/interfaces/http/schemas'

export const GET = route(() => useCases.newsletter.list(), { auth: 'admin' })

export const POST = route(async ({ user, body }) => created(await useCases.newsletter.create(user!, await body(newsletterCampaignSchema))), {
  auth: 'admin',
  rateLimit: 30,
})
