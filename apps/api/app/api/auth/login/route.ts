import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { loginSchema } from '@/interfaces/http/schemas'
import { consume } from '@/infrastructure/security/rate-limiter'
import { TooManyRequestsError } from '@/domain/errors'
import { RECAPTCHA_ACTIONS } from '@trs/shared'

export const POST = route(
  async ({ body, req, ip }) => {
    const input = await body(loginSchema)
    // Brute-force protection per account (5 attempts / 5 min)
    if (!(await consume(`login:${input.email}`, 5, 300_000, { critical: true }))) throw new TooManyRequestsError('Trop de tentatives. Réessayez dans 5 minutes.')
    return useCases.auth.login(input, { ip, userAgent: req.headers.get('user-agent') })
  },
  { rateLimit: 20, critical: true, captcha: RECAPTCHA_ACTIONS.login },
)
