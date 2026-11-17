import { route, created } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { ValidationError } from '@/domain/errors'

export const POST = route(
  async ({ req }) => {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) throw new ValidationError('Aucun fichier fourni')
    return created(
      await useCases.uploads.upload({
        file,
        folder: String(form.get('folder') || 'products'),
        productId: (form.get('productId') as string) || null,
        isMain: form.get('isMain') === 'true',
        color: String(form.get('color') ?? '').trim().slice(0, 40) || null,
      }),
    )
  },
  { auth: 'admin', rateLimit: 60 },
)
