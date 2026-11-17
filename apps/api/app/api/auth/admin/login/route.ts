import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { loginSchema } from '@/interfaces/http/schemas'
import { consume } from '@/infrastructure/security/rate-limiter'
import { TooManyRequestsError } from '@/domain/errors'
import { RECAPTCHA_ACTIONS } from '@trs/shared'

export const POST = route(
  async ({ body }) => {
    const input = await body(loginSchema)
    if (!(await consume(`admin-login:${input.email}`, 5, 300_000, { critical: true }))) throw new TooManyRequestsError('Trop de tentatives. Réessayez dans 5 minutes.')
    return useCases.auth.adminLogin(input)
  },
  { rateLimit: 10, critical: true, captcha: RECAPTCHA_ACTIONS.adminLogin },
)
