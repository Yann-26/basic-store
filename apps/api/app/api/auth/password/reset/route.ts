import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { resetPasswordSchema } from '@/interfaces/http/schemas'

/** Sets a new password from a reset link (single use, 1 hour). */
export const POST = route(async ({ body }) => useCases.account.resetPassword(await body(resetPasswordSchema)), { rateLimit: 10, critical: true })
