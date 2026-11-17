import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'

/** Which email service is configured. */
export const GET = route(async () => useCases.email.status(), { auth: 'admin' })

/** Sends a test email to the signed-in admin and reports why it failed, if it did. */
export const POST = route(async ({ user }) => useCases.email.sendTest(user!), { auth: 'admin', rateLimit: 5 })
