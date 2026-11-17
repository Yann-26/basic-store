import { route, created } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { brandSchema } from '@/interfaces/http/schemas'

export const GET = route(() => useCases.catalog.listBrands({ activeOnly: false }), { auth: 'admin' })

export const POST = route(async ({ body }) => created(await useCases.catalog.createBrand(await body(brandSchema))), { auth: 'admin' })
