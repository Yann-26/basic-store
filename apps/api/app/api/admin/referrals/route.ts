import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'

/** Who brings customers: referrers, their referred orders and rewards. */
export const GET = route(() => useCases.promo.referralStats(), { auth: 'admin' })
