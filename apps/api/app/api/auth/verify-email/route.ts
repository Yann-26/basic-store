import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { tokenSchema } from '@/interfaces/http/schemas'

/** Confirms the email address from the link sent by email. */
export const POST = route(async ({ body }) => useCases.account.verifyEmail((await body(tokenSchema)).token), { rateLimit: 20 })
