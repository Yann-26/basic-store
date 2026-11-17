import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { paymentReferenceParam, rejectPaymentSchema } from '@/interfaces/http/schemas'

type P = { reference: string }

/** No matching payment in Wave: the payment is refused and never counts. */
export const POST = route<P>(
  async ({ params, body, user }) =>
    useCases.payments.reject(paymentReferenceParam.parse(params).reference, await body(rejectPaymentSchema), user!),
  { auth: 'admin', rateLimit: 30, rateLimitKey: 'admin-payment-reject' },
)
