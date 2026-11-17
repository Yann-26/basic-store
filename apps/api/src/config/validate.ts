import { env } from './env'

export interface ConfigReport {
  /** Missing or unsafe settings that break a security control in production. */
  errors: string[]
  /** Recommended settings (the app works, with a weaker control). */
  warnings: string[]
}

type EnvLike = Pick<typeof env, 'isProduction' | 'appUrl' | 'supabaseUrl' | 'supabaseServiceKey' | 'jwtSecret' | 'recaptchaSecret' | 'paystackSecret' | 'redis'>

/**
 * Checks the production configuration. Never returns values, only variable names,
 * so the report can be logged and exposed by /api/health.
 */
export function validateConfig(e: EnvLike = env): ConfigReport {
  const errors: string[] = []
  const warnings: string[] = []
  if (!e.supabaseUrl) errors.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!e.supabaseServiceKey) errors.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!e.jwtSecret || e.jwtSecret.length < 32) errors.push('AUTH_JWT_SECRET (>= 32 characters)')
  if (!e.isProduction) return { errors: [], warnings: errors }

  if (!e.recaptchaSecret) errors.push('RECAPTCHA_SECRET_KEY')
  if (!e.paystackSecret) errors.push('PAYSTACK_SECRET_KEY')
  if (!e.appUrl.startsWith('https://')) errors.push('NEXT_PUBLIC_APP_URL (must be https)')
  if (!e.redis.url || !e.redis.token) warnings.push('UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (rate limits are per instance)')
  return { errors, warnings }
}

let reported = false

/** Logs the configuration problems once per instance. */
export function reportConfigOnce(): ConfigReport {
  const report = validateConfig()
  if (!reported) {
    reported = true
    if (report.errors.length) console.error(JSON.stringify({ level: 'error', msg: 'config.invalid', missing: report.errors }))
    if (report.warnings.length) console.warn(JSON.stringify({ level: 'warn', msg: 'config.degraded', missing: report.warnings }))
  }
  return report
}
