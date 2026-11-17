import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { newsletterCampaignUpdateSchema, uuidParam } from '@/interfaces/http/schemas'

const opts = { auth: 'admin' as const, rateLimitKey: 'admin-newsletter-campaign' }

export const GET = route<{ id: string }>(({ params }) => useCases.newsletter.get(uuidParam.parse(params).id), opts)

/** Only drafts, scheduled and cancelled campaigns can be edited. */
export const PUT = route<{ id: string }>(async ({ params, body }) => useCases.newsletter.update(uuidParam.parse(params).id, await body(newsletterCampaignUpdateSchema)), {
  ...opts,
  rateLimit: 60,
})

export const DELETE = route<{ id: string }>(async ({ params }) => {
  await useCases.newsletter.remove(uuidParam.parse(params).id)
  return { success: true }
}, opts)
