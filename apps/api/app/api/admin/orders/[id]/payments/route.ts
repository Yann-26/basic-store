import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { manualPaymentSchema, uuidParam } from '@/interfaces/http/schemas'

type P = { id: string }

/** Records money received outside the website (cash, Mobile Money to the shop…) on an order. */
export const POST = route<P>(
  async ({ params, body, user }) => useCases.payments.recordManual(uuidParam.parse(params).id, await body(manualPaymentSchema), user!),
  { auth: 'admin', rateLimit: 30, rateLimitKey: 'admin-order-payment' },
)
