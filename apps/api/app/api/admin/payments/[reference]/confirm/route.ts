import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { paymentReferenceParam } from '@/interfaces/http/schemas'

type P = { reference: string }

/** The payment was found in the Wave Business app: it now counts as money received. */
export const POST = route<P>(({ params, user }) => useCases.payments.confirm(paymentReferenceParam.parse(params).reference, user!), {
  auth: 'admin',
  rateLimit: 30,
  rateLimitKey: 'admin-payment-confirm',
})
