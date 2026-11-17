import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { unsubscribeSchema } from '@/interfaces/http/schemas'

/**
 * Unsubscribe from a signed link: JSON body from the /desinscription page, or
 * the RFC 8058 one-click POST of mail clients (parameters in the URL).
 */
export const POST = route(
  async ({ req, query, body }) => {
    const fromUrl = req.nextUrl.searchParams.has('e')
    const { e, t } = fromUrl ? query(unsubscribeSchema) : await body(unsubscribeSchema)
    return useCases.newsletter.unsubscribe(e, t)
  },
  { rateLimit: 20 },
)
