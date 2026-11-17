import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { uuidParam } from '@/interfaces/http/schemas'
import { defer } from '@/infrastructure/background'

export const maxDuration = 60

/** Sends now: the first batches leave right after the response, the cron worker sends the rest. */
export const POST = route<{ id: string }>(async ({ params }) => {
  const campaign = await useCases.newsletter.sendNow(uuidParam.parse(params).id)
  defer(() => useCases.newsletter.processDue())
  return campaign
}, { auth: 'admin', rateLimit: 10, rateLimitKey: 'admin-newsletter-send' })
