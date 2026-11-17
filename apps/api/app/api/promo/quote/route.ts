import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { promoQuoteSchema } from '@/interfaces/http/schemas'

/** Checkout: what a promo or referral code takes off the current basket. */
export const POST = route(
  async ({ body, user }) =>
    useCases.orders.quotePromo(await body(promoQuoteSchema), { userId: user!.id, emailVerified: user!.email_verified, email: user!.email }),
  { auth: 'user', rateLimit: 20 },
)
