import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'

/** "Mon compte → Parrainage": the code to share and what it brought. */
export const GET = route(({ user }) => useCases.promo.myReferral(user!), { auth: 'user' })
