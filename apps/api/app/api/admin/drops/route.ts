import { route, created } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { dropSchema } from '@/interfaces/http/schemas'

export const GET = route(() => useCases.drops.list(), { auth: 'admin' })

export const POST = route(async ({ body }) => created(await useCases.drops.create(await body(dropSchema))), { auth: 'admin' })
