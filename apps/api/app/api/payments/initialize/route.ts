import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { initializePaymentSchema } from '@/interfaces/http/schemas'

/** Owner (or admin) only: opens the Paystack checkout for what the order still needs. */
export const POST = route(
  async ({ body, user }) => useCases.payments.initialize(await body(initializePaymentSchema), user!),
  { auth: 'user', rateLimit: 5, critical: true },
)
