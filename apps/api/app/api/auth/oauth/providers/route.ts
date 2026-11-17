import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'

/** Social sign-in methods configured on the server (the storefront shows only these buttons). */
export const GET = route(async () => useCases.social.available(), { cache: 'public, max-age=300' })
