import { route, created } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { ValidationError } from '@/domain/errors'

/** A customer's photo for their review (images only, 5 MB). */
export const POST = route(
  async ({ req }) => {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) throw new ValidationError('Aucun fichier fourni')
    const { url } = await useCases.uploads.upload({ file, folder: 'reviews' })
    return created({ url })
  },
  { auth: 'user', rateLimit: 6 },
)
