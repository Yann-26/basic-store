import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { oauthExchangeSchema } from '@/interfaces/http/schemas'

/** One-time code from the social sign-in redirect → session. */
export const POST = route(
  async ({ body, req, ip }) => {
    const { code } = await body(oauthExchangeSchema)
    return useCases.social.exchange(code, { ip, userAgent: req.headers.get('user-agent') })
  },
  { rateLimit: 20, critical: true },
)
