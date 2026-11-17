import { route, created } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { contactSchema } from '@/interfaces/http/schemas'
import { RECAPTCHA_ACTIONS } from '@trs/shared'

export const POST = route(
  async ({ body }) => created(await useCases.engagement.sendContactMessage(await body(contactSchema))),
  { rateLimit: 5, captcha: RECAPTCHA_ACTIONS.contact },
)
