import nodemailer, { type Transporter } from 'nodemailer'
import type { Mailer } from '@/application/ports'
import { parseSender } from './brevo.mailer'
import { brand } from '@/application/brand'

export interface SmtpSettings {
  host?: string
  port: number
  user: string
  pass: string
  /** EMAIL_FROM: only its display name is used when it's not the SMTP account's address. */
  from: string
}

const GMAIL = /@(gmail|googlemail)\.com$/i

/** Gmail (and most providers) only send as the signed-in account: keep the name, use that address. */
export function smtpSender(from: string, user: string): string {
  const { name, email } = parseSender(from)
  const address = email.toLowerCase() === user.toLowerCase() ? email : user
  return `${(name ?? brand().name).replace(/["<>]/g, '')} <${address}>`
}

/**
 * Transactional emails through SMTP — e.g. Gmail with an app password
 * (free, ~500 emails/day, no extra account). Never throws: a failed email must
 * not break the action that triggered it.
 */
export class SmtpMailer implements Mailer {
  private transporter: Transporter | null = null
  private lastError: string | null = null
  readonly from: string

  constructor(private readonly settings: SmtpSettings) {
    this.from = smtpSender(settings.from, settings.user)
  }

  private transport() {
    const host = this.settings.host ?? (GMAIL.test(this.settings.user) ? 'smtp.gmail.com' : undefined)
    this.transporter ??= nodemailer.createTransport({
      host,
      port: this.settings.port,
      secure: this.settings.port === 465,
      auth: { user: this.settings.user, pass: this.settings.pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    })
    return this.transporter
  }

  async send(message: { to: string; subject: string; html: string; replyTo?: string; headers?: Record<string, string> }) {
    try {
      await this.transport().sendMail({ from: smtpSender(`${brand().name} <${parseSender(this.from).email}>`, this.settings.user), to: message.to, subject: message.subject, html: message.html, replyTo: message.replyTo, headers: message.headers })
      this.lastError = null
      return true
    } catch (error) {
      this.lastError = explain(error)
      console.error('[mail] SMTP send failed:', this.lastError, '—', message.subject)
      return false
    }
  }

  status() {
    return { provider: 'smtp' as const, from: this.from, lastError: this.lastError }
  }
}

/** Human explanation of the usual SMTP failures (never includes the password). */
function explain(error: unknown): string {
  const e = error as { code?: string; responseCode?: number; message?: string }
  if (e.code === 'EAUTH' || e.responseCode === 535) {
    return 'Identifiants refusés : utilisez un « mot de passe d’application » Google (pas votre mot de passe Gmail), avec la validation en deux étapes activée.'
  }
  if (e.code === 'ETIMEDOUT' || e.code === 'ECONNECTION' || e.code === 'ESOCKET') return `Serveur SMTP injoignable (${e.code}).`
  return (e.message ?? String(error)).slice(0, 300)
}
