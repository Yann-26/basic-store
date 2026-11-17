import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { twoFactorCodeSchema } from '@/interfaces/http/schemas'

/** New recovery codes (the previous ones stop working); needs a current authenticator code. */
export const POST = route(
  async ({ user, body }) => useCases.auth.regenerateRecoveryCodes(user!, (await body(twoFactorCodeSchema)).code),
  { auth: 'admin', rateLimit: 5, critical: true },
)
