import { route, created } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { promoCodeSchema } from '@/interfaces/http/schemas'

const SOURCES = ['manual', 'referral', 'reward'] as const

export const GET = route(({ req }) => {
  const params = new URL(req.url).searchParams
  const source = SOURCES.find((s) => s === params.get('source'))
  return useCases.promo.list({ source, search: params.get('search') ?? undefined })
}, { auth: 'admin' })

export const POST = route(async ({ body }) => created(await useCases.promo.create(await body(promoCodeSchema))), { auth: 'admin' })
