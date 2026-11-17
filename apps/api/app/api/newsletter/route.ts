import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { newsletterSchema } from '@/interfaces/http/schemas'
import { RECAPTCHA_ACTIONS } from '@trs/shared'

export const POST = route(
  async ({ body }) => {
    const { email, source } = await body(newsletterSchema)
    return useCases.engagement.subscribe(email, source)
  },
  { rateLimit: 5, captcha: RECAPTCHA_ACTIONS.newsletter },
)
