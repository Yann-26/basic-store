import { route } from '@/interfaces/http/handler'
import { reportConfigOnce } from '@/config/validate'

// Names of missing variables only — never their values.
export const GET = route(async () => {
  const { errors, warnings } = reportConfigOnce()
  return {
    status: 'ok',
    service: 'the-rising-star-api',
    time: new Date().toISOString(),
    config: errors.length ? 'invalid' : warnings.length ? 'degraded' : 'ok',
    ...(errors.length || warnings.length ? { missing: [...errors, ...warnings] } : {}),
  }
})
