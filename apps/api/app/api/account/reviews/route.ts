import { z } from 'zod'
import { route, created } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { reviewSchema } from '@/interfaces/http/schemas'

/** Whether the customer can review a piece (delivered order), and their review. */
export const GET = route(
  async ({ user, query }) => useCases.reviews.mine(user!, query(z.object({ product_id: z.string().uuid() })).product_id),
  { auth: 'user' },
)

export const POST = route(async ({ user, body }) => created(await useCases.reviews.submit(user!, await body(reviewSchema))), { auth: 'user', rateLimit: 10 })
