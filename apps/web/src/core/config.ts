export const config = {
  apiUrl: (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api')).replace(/\/$/, ''),
  recaptchaSiteKey: import.meta.env.VITE_RECAPTCHA_SITE_KEY || '',
} as const
