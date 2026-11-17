import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { env } from '@/config/env'
import { UnauthorizedError } from '@/domain/errors'

export const maxDuration = 60

/**
 * Newsletter worker (and expiry of unpaid online orders), called every 5 minutes by Supabase pg_cron (secret kept in
 * Vault) or by a Vercel cron (CRON_SECRET), with `Authorization: Bearer <secret>`.
 */
async function run({ req }: { req: Request }) {
  const header = req.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!(await useCases.newsletter.isSchedulerCall(token, env.cronSecret))) throw new UnauthorizedError()
  const newsletter = await useCases.newsletter.processDue()
  // The same tick cancels online orders left unpaid, so their stock goes back on the shelves.
  const expired = await useCases.orders.expireUnpaidOnline().catch((err: unknown) => {
    console.error(JSON.stringify({ level: 'error', msg: 'orders.expire_unpaid', error: String(err) }))
    return null
  })
  return { ...newsletter, expired }
}

export const GET = route(run, { rateLimit: 30 })
export const POST = route(run, { rateLimit: 30 })
