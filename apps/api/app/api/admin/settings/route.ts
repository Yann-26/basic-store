import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { settingsUpdateSchema } from '@/interfaces/http/schemas'

// The back-office reads here, never cached: right after a save it must see the new values,
// not the copy the CDN keeps of the public /api/settings.
export const GET = route(() => useCases.settings.getPublic(), { auth: 'admin' })

export const PUT = route(async ({ body }) => {
  await useCases.settings.update(await body(settingsUpdateSchema))
  return { success: true }
}, { auth: 'admin' })
