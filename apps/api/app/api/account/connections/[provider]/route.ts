import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'

/** Single-use ticket to start linking this provider (the browser then opens /auth/oauth/:provider/start?link=…). */
export const POST = route<{ provider: string }>(async ({ user, params }) => useCases.social.linkTicket(user!, params.provider), {
  auth: 'user',
  rateLimit: 10,
  rateLimitKey: 'account-connections',
})

export const DELETE = route<{ provider: string }>(async ({ user, params }) => useCases.social.unlink(user!, params.provider), {
  auth: 'user',
  rateLimit: 10,
  rateLimitKey: 'account-connections',
})
