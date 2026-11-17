import type { SessionUser } from '@trs/shared'
import type { Mailer } from '../ports'
import { testEmail } from '../templates/emails'
import { brand } from '../brand'

const PROVIDER_LABEL = { smtp: 'SMTP (Gmail)', brevo: 'Brevo', none: 'aucun' } as const

/** Back-office check that emails really leave: status + a test email to the admin. */
export function makeEmailUseCases(d: { mailer: Mailer }) {
  return {
    status() {
      const s = d.mailer.status()
      return { provider: s.provider, from: s.from }
    },

    async sendTest(admin: SessionUser) {
      const s = d.mailer.status()
      const sent =
        s.provider !== 'none' &&
        (await d.mailer.send({ to: admin.email, subject: `Test — les emails de ${brand().name} fonctionnent`, html: testEmail({ firstName: admin.first_name, provider: PROVIDER_LABEL[s.provider], from: s.from ?? '' }) }))
      return { sent, to: admin.email, provider: s.provider, from: s.from, error: sent ? null : (d.mailer.status().lastError ?? 'Aucun service d’envoi configuré.') }
    },
  }
}
