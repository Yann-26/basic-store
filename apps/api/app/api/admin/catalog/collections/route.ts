import { route, created } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { collectionSchema } from '@/interfaces/http/schemas'

export const GET = route(() => useCases.catalog.listCollections({ activeOnly: false }), { auth: 'admin' })

export const POST = route(async ({ body }) => created(await useCases.catalog.createCollection(await body(collectionSchema))), {
  auth: 'admin',
})
