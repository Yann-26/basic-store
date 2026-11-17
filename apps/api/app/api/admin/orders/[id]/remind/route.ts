import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { uuidParam } from '@/interfaces/http/schemas'

type P = { id: string }

/** Emails the customer the balance still due, with the link to pay it online. */
export const POST = route<P>(({ params }) => useCases.payments.remind(uuidParam.parse(params).id), {
  auth: 'admin',
  rateLimit: 10,
  rateLimitKey: 'admin-order-remind',
})
