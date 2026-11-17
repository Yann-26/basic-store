import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'

/** Two-factor status of the signed-in admin. */
export const GET = route(({ user }) => useCases.auth.twoFactorStatus(user!), { auth: 'admin' })
