import { route, created } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { oauthSignupSchema } from '@/interfaces/http/schemas'

/** Finishes a social sign-up when the provider gave no email address (TikTok). */
export const POST = route(
  async ({ body, req, ip }) => created(await useCases.social.completeSignup(await body(oauthSignupSchema), { ip, userAgent: req.headers.get('user-agent') })),
  { rateLimit: 10, critical: true },
)
