import { z } from 'zod'
import { route, created } from '@/interfaces/http/handler'
import { useCases } from '@/container'

type P = { id: string }

/** A one-time URL to upload the GLB straight to Storage. */
export const POST = route<P>(
  async ({ params, body }) => created(await useCases.products.model3DUploadUrl(params.id, await body(z.object({ size: z.coerce.number().int().positive() })))),
  { auth: 'admin', rateLimit: 20 },
)
