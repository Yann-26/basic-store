import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { verifyPaymentSchema } from '@/interfaces/http/schemas'

/** Back from Paystack: the server asks Paystack whether the payment went through. */
export const POST = route(async ({ body }) => useCases.payments.verify((await body(verifyPaymentSchema)).reference), { rateLimit: 20 })
