/**
 * Typed, centralised access to environment variables.
 * Nothing else in the codebase should read `process.env` directly.
 */
function read(name: string): string | undefined {
  const value = process.env[name]
  return value && value.trim() !== '' ? value.trim() : undefined
}

export const env = {
  isProduction: process.env.NODE_ENV === 'production',

  appUrl: read('NEXT_PUBLIC_APP_URL') ?? 'http://localhost:3000',
  allowedOrigins: (read('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  supabaseUrl: read('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: read('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  supabaseServiceKey: read('SUPABASE_SERVICE_ROLE_KEY'),

  jwtSecret: read('AUTH_JWT_SECRET'),

  recaptchaSecret: read('RECAPTCHA_SECRET_KEY'),
  recaptchaMinScore: Number(read('RECAPTCHA_MIN_SCORE') ?? '0.5'),

  paystackSecret: read('PAYSTACK_SECRET_KEY'),
  /** Paystack signs its webhooks with the secret key itself. */
  paystackWebhookSecret: read('PAYSTACK_WEBHOOK_SECRET') ?? read('PAYSTACK_SECRET_KEY'),

  brevoApiKey: read('BREVO_API_KEY'),

  /** Authenticates the scheduled-jobs endpoint (/api/cron/*). */
  cronSecret: read('CRON_SECRET'),

  /**
   * Emails through any SMTP server — simplest: a Gmail address + an app password
   * (SMTP_USER=shop@gmail.com, SMTP_PASS=16-letter app password; host defaults to Gmail).
   * Takes precedence over Brevo when set.
   */
  smtp: {
    host: read('SMTP_HOST'),
    port: Number(read('SMTP_PORT') ?? '465'),
    user: read('SMTP_USER'),
    // Google shows app passwords as "abcd efgh ijkl mnop"
    pass: read('SMTP_PASS')?.replace(/\s+/g, ''),
  },

  /** Shared rate-limit counters (Upstash Redis REST, or Vercel KV). Optional. */
  redis: {
    url: read('UPSTASH_REDIS_REST_URL') ?? read('KV_REST_API_URL'),
    token: read('UPSTASH_REDIS_REST_TOKEN') ?? read('KV_REST_API_TOKEN'),
  },
  emailFrom: read('EMAIL_FROM') ?? 'SCION CARON <hello@therisingstar.ci>',
  adminNotificationEmail: read('ADMIN_NOTIFICATION_EMAIL'),

  /** Social sign-in apps; a provider without keys is simply not offered. */
  oauth: {
    /** Where providers send users back (default `${appUrl}/api`, same domain as the shop). */
    callbackBase: read('OAUTH_CALLBACK_BASE'),
    google: { clientId: read('GOOGLE_CLIENT_ID'), clientSecret: read('GOOGLE_CLIENT_SECRET') },
    facebook: { clientId: read('FACEBOOK_APP_ID'), clientSecret: read('FACEBOOK_APP_SECRET') },
    tiktok: { clientId: read('TIKTOK_CLIENT_KEY'), clientSecret: read('TIKTOK_CLIENT_SECRET') },
  },

  instagram: {
    appId: read('INSTAGRAM_APP_ID'),
    appSecret: read('INSTAGRAM_APP_SECRET'),
    redirectUri: read('INSTAGRAM_REDIRECT_URI'),
  },
} as const

export function allowedOrigins(): string[] {
  return [env.appUrl.replace(/\/$/, ''), ...env.allowedOrigins]
}
