import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { uuidParam } from '@/interfaces/http/schemas'

/** For an admin who lost their phone and recovery codes: they enrol again at next sign-in. */
export const POST = route<{ id: string }>(
  async ({ params, user }) => useCases.users.resetTwoFactor(user!, uuidParam.parse(params).id),
  { auth: 'admin', rateLimit: 10, rateLimitKey: 'admin-users-reset-2fa' },
)
