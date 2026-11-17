import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { uuidParam } from '@/interfaces/http/schemas'

export const POST = route<{ id: string }>(({ params }) => useCases.newsletter.cancel(uuidParam.parse(params).id), {
  auth: 'admin',
  rateLimit: 20,
  rateLimitKey: 'admin-newsletter-cancel',
})
