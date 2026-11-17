import type { Mailer } from '@/application/ports'
import { env } from '@/config/env'
import { BrevoMailer, parseSender } from './brevo.mailer'
import { SmtpMailer } from './smtp.mailer'

/** SMTP (e.g. Gmail + app password) when configured, else Brevo. */
export function createMailer(): Mailer {
  const { user, pass } = env.smtp
  if (user && pass) return new SmtpMailer({ ...env.smtp, user, pass, from: env.emailFrom })
  return new BrevoMailer()
}

/** The address emails actually come from (used as the reply-to / contact address). */
export function senderAddress(mailer: Mailer): string {
  return parseSender(mailer.status().from ?? env.emailFrom).email
}
