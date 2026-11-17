import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'

// Paystack signs the raw body: read it as text, never re-serialise it.
export const POST = route(
  async ({ req }) => useCases.payments.handleWebhook(await req.text(), req.headers.get('x-paystack-signature')),
  { rateLimit: 300 },
)
