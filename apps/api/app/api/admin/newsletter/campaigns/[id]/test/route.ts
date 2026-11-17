import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { uuidParam } from '@/interfaces/http/schemas'

/** Sends the campaign to the signed-in admin only. */
export const POST = route<{ id: string }>(({ params, user }) => useCases.newsletter.sendTest(user!, uuidParam.parse(params).id), {
  auth: 'admin',
  rateLimit: 10,
  rateLimitKey: 'admin-newsletter-test',
})
