import { allowedOrigins, env } from '@/config/env'

const DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

/** Origins allowed to call the API with credentials: the shop, ALLOWED_ORIGINS, and localhost in development. */
export function isAllowedOrigin(origin: string | null | undefined): origin is string {
  if (!origin) return false
  const o = origin.replace(/\/$/, '')
  return allowedOrigins().includes(o) || (!env.isProduction && DEV_ORIGIN.test(o))
}
