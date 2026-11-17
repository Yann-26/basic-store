import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { twoFactorVerifySchema } from '@/interfaces/http/schemas'
import { consume } from '@/infrastructure/security/rate-limiter'
import { TooManyRequestsError } from '@/domain/errors'

/** Admin sign-in, step 2: authenticator (or recovery) code for the challenge from step 1. */
export const POST = route(
  async ({ body, req, ip }) => {
    const input = await body(twoFactorVerifySchema)
    // 5 tries per challenge; a new challenge needs the password again (itself rate-limited).
    if (!(await consume(`admin-2fa:${input.challenge.slice(-43)}`, 5, 300_000, { critical: true }))) throw new TooManyRequestsError('Trop de tentatives. Reconnectez-vous.')
    return useCases.auth.verifyAdminTwoFactor(input, { ip, userAgent: req.headers.get('user-agent') })
  },
  { rateLimit: 10, critical: true },
)
