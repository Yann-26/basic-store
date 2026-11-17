import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { promoCodePatchSchema } from '@/interfaces/http/schemas'

type P = { id: string }

export const PUT = route<P>(async ({ params, body }) => useCases.promo.update(params.id, await body(promoCodePatchSchema)), { auth: 'admin' })

export const DELETE = route<P>(({ params }) => useCases.promo.remove(params.id), { auth: 'admin' })
