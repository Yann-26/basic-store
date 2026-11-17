import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'

/** "Mon compte": the signed-in user's orders. */
export const GET = route(({ user }) => useCases.account.myOrders(user!), { auth: 'user' })
