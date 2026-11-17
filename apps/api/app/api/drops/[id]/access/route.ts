import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'

/** Where a drop stands for the visitor: closed, early access (and whether they are on the list), open. */
export const GET = route<{ id: string }>(async ({ params, user }) => useCases.drops.access(params.id, user), { rateLimit: 60 })
