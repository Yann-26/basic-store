import { route, created } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { registerSchema } from '@/interfaces/http/schemas'
import { consume } from '@/infrastructure/security/rate-limiter'
import { TooManyRequestsError } from '@/domain/errors'
import { RECAPTCHA_ACTIONS } from '@trs/shared'

export const POST = route(
  async ({ body, ip }) => {
    const input = await body(registerSchema)
    if (!(await consume(`register:${ip}`, 5, 3_600_000, { critical: true }))) throw new TooManyRequestsError("Trop d'inscriptions depuis cette adresse. Réessayez plus tard.")
    const { marketingOptIn, ...account } = input
    const res = await useCases.auth.register({ ...account, phone: account.phone ?? null })
    if (marketingOptIn) await useCases.newsletter.setPreferences(res.user, { marketingOptIn: true })
    return created(res)
  },
  { rateLimit: 10, critical: true, captcha: RECAPTCHA_ACTIONS.register },
)
