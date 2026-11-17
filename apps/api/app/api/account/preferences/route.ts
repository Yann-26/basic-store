import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { preferencesSchema } from '@/interfaces/http/schemas'

/** Email preferences of the signed-in customer (news & offers). */
export const GET = route(({ user }) => useCases.newsletter.getPreferences(user!), { auth: 'user' })
export const PUT = route(async ({ user, body }) => useCases.newsletter.setPreferences(user!, await body(preferencesSchema)), { auth: 'user', rateLimit: 20 })
