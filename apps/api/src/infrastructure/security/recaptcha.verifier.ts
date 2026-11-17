import type { CaptchaVerifier } from '@/application/ports'
import { CaptchaError } from '@/domain/errors'
import { env } from '@/config/env'

const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify'

interface SiteVerifyResponse {
  success: boolean
  score?: number
  action?: string
  hostname?: string
  'error-codes'?: string[]
}

/**
 * Google reCAPTCHA v3 verifier (invisible, score based).
 * When RECAPTCHA_SECRET_KEY is not configured the check is skipped in local
 * development only; in production a missing key fails closed.
 */
export class GoogleRecaptchaVerifier implements CaptchaVerifier {
  private warned = false

  async verify(token: string | null | undefined, action: string, remoteIp?: string) {
    if (!env.recaptchaSecret) {
      if (env.isProduction) {
        console.error('[recaptcha] RECAPTCHA_SECRET_KEY missing in production — request refused')
        throw new CaptchaError('Service de vérification indisponible. Réessayez dans un instant.')
      }
      if (!this.warned) {
        console.warn('[recaptcha] RECAPTCHA_SECRET_KEY not set — captcha verification is DISABLED')
        this.warned = true
      }
      return
    }
    if (!token) throw new CaptchaError('Vérification anti-robot manquante. Rechargez la page et réessayez.')

    const body = new URLSearchParams({ secret: env.recaptchaSecret, response: token })
    if (remoteIp) body.set('remoteip', remoteIp)

    let result: SiteVerifyResponse
    try {
      const res = await fetch(VERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(5000) })
      result = (await res.json()) as SiteVerifyResponse
    } catch (error) {
      console.error('[recaptcha] verification request failed', error)
      throw new CaptchaError('Service de vérification indisponible. Réessayez dans un instant.')
    }

    if (!result.success) {
      console.warn('[recaptcha] rejected', result['error-codes'])
      throw new CaptchaError()
    }
    if (result.action && result.action !== action) {
      console.warn(`[recaptcha] action mismatch: expected ${action}, got ${result.action}`)
      throw new CaptchaError()
    }
    if (typeof result.score === 'number' && result.score < env.recaptchaMinScore) {
      console.warn(`[recaptcha] low score ${result.score} for ${action}`)
      throw new CaptchaError('Activité suspecte détectée. Veuillez réessayer.')
    }
  }
}
