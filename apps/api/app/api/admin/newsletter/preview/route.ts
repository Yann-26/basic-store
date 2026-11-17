import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { newsletterPreviewSchema } from '@/interfaces/http/schemas'

/** Email HTML for the editor's live preview (shown in a sandboxed iframe). */
export const POST = route(async ({ user, body }) => useCases.newsletter.preview(user!, await body(newsletterPreviewSchema)), { auth: 'admin', rateLimit: 120 })
