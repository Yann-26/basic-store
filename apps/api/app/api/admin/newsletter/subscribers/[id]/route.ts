import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { uuidParam } from '@/interfaces/http/schemas'

export const DELETE = route<{ id: string }>(async ({ params }) => {
  await useCases.newsletter.deleteSubscriber(uuidParam.parse(params).id)
  return { success: true }
}, { auth: 'admin', rateLimitKey: 'admin-newsletter-subscriber' })
