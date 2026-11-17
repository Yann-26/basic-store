import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { changePasswordSchema } from '@/interfaces/http/schemas'
import { consume } from '@/infrastructure/security/rate-limiter'
import { TooManyRequestsError } from '@/domain/errors'

export const POST = route(
  async ({ body, user }) => {
    const input = await body(changePasswordSchema)
    // Guessing the current password from a stolen session: 5 tries / 15 min per account
    if (!(await consume(`change-password:${user!.id}`, 5, 900_000, { critical: true }))) throw new TooManyRequestsError('Trop de tentatives. Réessayez dans 15 minutes.')
    return useCases.auth.changePassword(user!, input)
  },
  { auth: 'user', rateLimit: 10, critical: true },
)
