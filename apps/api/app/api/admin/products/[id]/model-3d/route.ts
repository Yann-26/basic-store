import { z } from 'zod'
import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'

type P = { id: string }

/** Saves the piece's 3D model settings (validated and cleaned by the use-case). */
export const PUT = route<P>(async ({ params, body }) => useCases.products.setModel3D(params.id, await body(z.record(z.string(), z.unknown()))), { auth: 'admin' })

/** Removes the 3D model (and its file). */
export const DELETE = route<P>(({ params }) => useCases.products.setModel3D(params.id, null), { auth: 'admin' })
