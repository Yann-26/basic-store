import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { profileSchema } from '@/interfaces/http/schemas'

/** Updates name and phone; returns a fresh session with the new details. */
export const PUT = route(async ({ user, body }) => useCases.account.updateProfile(user!, await body(profileSchema)), { auth: 'user', rateLimit: 20 })
