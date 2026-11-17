import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { newsletterScheduleSchema, uuidParam } from '@/interfaces/http/schemas'

/** Programs the campaign for a date (ISO, UTC — Abidjan time). */
export const POST = route<{ id: string }>(async ({ params, body }) => useCases.newsletter.schedule(uuidParam.parse(params).id, (await body(newsletterScheduleSchema)).at), {
  auth: 'admin',
  rateLimit: 20,
  rateLimitKey: 'admin-newsletter-schedule',
})
