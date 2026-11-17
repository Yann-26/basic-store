import { route, created } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { createOrderSchema } from '@/interfaces/http/schemas'
import { RECAPTCHA_ACTIONS } from '@trs/shared'

export const POST = route(
  async ({ body, user }) =>
    created(await useCases.orders.create(await body(createOrderSchema), { userId: user!.id, emailVerified: user!.email_verified, email: user!.email })),
  { auth: 'user', rateLimit: 10, captcha: RECAPTCHA_ACTIONS.checkout },
)
