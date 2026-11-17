import { RECAPTCHA_ACTIONS } from '@trs/shared'
import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { forgotPasswordSchema } from '@/interfaces/http/schemas'
import { consume } from '@/infrastructure/security/rate-limiter'

/** Emails a reset link if the account exists; the answer is always the same. */
export const POST = route(
  async ({ body }) => {
    const { email } = await body(forgotPasswordSchema)
    // Past the limit, silently skip sending (same answer, so no account enumeration).
    if (!(await consume(`forgot:${email}`, 3, 3_600_000, { critical: true }))) return { success: true }
    return useCases.account.requestPasswordReset(email)
  },
  { rateLimit: 5, critical: true, captcha: RECAPTCHA_ACTIONS.forgotPassword },
)
