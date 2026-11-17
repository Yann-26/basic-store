import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { consume } from '@/infrastructure/security/rate-limiter'
import { TooManyRequestsError } from '@/domain/errors'

/** Sends a new verification link to the signed-in user. */
export const POST = route(
  async ({ user }) => {
    if (!(await consume(`verify-resend:${user!.id}`, 3, 900_000, { critical: true }))) throw new TooManyRequestsError('Un email vient déjà de partir. Réessayez dans quelques minutes.')
    return useCases.account.sendVerification(user!)
  },
  { auth: 'user', rateLimit: 10, critical: true },
)
