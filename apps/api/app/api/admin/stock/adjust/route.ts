import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { stockAdjustSchema } from '@/interfaces/http/schemas'

/** Restock, in-store sale or inventory correction of one size of a product. */
export const POST = route(async ({ body, user }) => useCases.stock.adjust(await body(stockAdjustSchema), user!), { auth: 'admin', rateLimit: 120 })
