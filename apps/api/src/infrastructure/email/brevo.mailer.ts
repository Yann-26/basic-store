import type { Mailer } from '@/application/ports'
import { env } from '@/config/env'
import { brand } from '@/application/brand'

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'
const TIMEOUT_MS = 8000

/** "Basic Store <shop@gmail.com>" → { name, email }. */
export function parseSender(from: string): { name?: string; email: string } {
  const match = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/)
  if (match) return { name: match[1]!.trim() || undefined, email: match[2]!.trim() }
  return { email: from.trim() }
}

/**
 * Transactional emails through Brevo (free plan: 300 emails/day). The sender
 * (EMAIL_FROM) must be a verified sender or domain in the Brevo account —
 * a single verified address such as a Gmail one is enough.
 * Never throws: a failed email must not break the action that triggered it.
 */
export class BrevoMailer implements Mailer {
  private lastError: string | null = null

  status() {
    return { provider: env.brevoApiKey ? ('brevo' as const) : ('none' as const), from: env.brevoApiKey ? env.emailFrom : null, lastError: this.lastError }
  }

  async send(message: { to: string; subject: string; html: string; replyTo?: string; headers?: Record<string, string> }) {
    if (!env.brevoApiKey) {
      this.lastError = 'Aucun service d’envoi configuré (SMTP_USER + SMTP_PASS, ou BREVO_API_KEY).'
      console.warn('[mail] no email service configured — email not sent:', message.subject)
      return false
    }
    try {
      const res = await fetch(BREVO_URL, {
        method: 'POST',
        headers: { 'api-key': env.brevoApiKey, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender: { ...parseSender(env.emailFrom), name: brand().name },
          to: [{ email: message.to }],
          subject: message.subject,
          htmlContent: message.html,
          ...(message.replyTo ? { replyTo: { email: message.replyTo } } : {}),
          ...(message.headers ? { headers: message.headers } : {}),
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!res.ok) {
        // Brevo explains the problem (unverified sender, invalid key…) in the body; no secret in it.
        this.lastError = `Brevo ${res.status} : ${(await res.text()).slice(0, 300)}`
        console.error('[mail] Brevo refused the email', this.lastError, '—', message.subject)
        return false
      }
      this.lastError = null
      return true
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
      console.error('[mail] send failed', error instanceof Error ? error.message : error, '—', message.subject)
      return false
    }
  }
}
