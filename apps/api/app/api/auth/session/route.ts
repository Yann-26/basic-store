import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { UnauthorizedError } from '@/domain/errors'

/**
 * One-time upgrade for browsers signed in before sessions moved to cookies:
 * the old Bearer token (from localStorage) is exchanged for the HttpOnly cookie,
 * so nobody is logged out by the change.
 */
export const POST = route(
  async ({ req, user }) => {
    if (!req.headers.get('authorization')?.startsWith('Bearer ')) throw new UnauthorizedError()
    return useCases.auth.reissue(user!)
  },
  { auth: 'user', rateLimit: 10, critical: true },
)
