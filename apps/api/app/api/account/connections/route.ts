import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'

/** Social accounts linked to the signed-in user. */
export const GET = route(async ({ user }) => useCases.social.linkedAccounts(user!), { auth: 'user' })
