import { describe, expect, it, vi } from 'vitest'
import { makeAccountNotifications } from '../notifications'
import { describeDevice } from '../templates/emails'
import type { Mailer } from '../ports'

function setup() {
  const mailer: Mailer = { send: vi.fn(async () => true), status: () => ({ provider: 'smtp' as const, from: 'shop@gmail.com', lastError: null }) }
  const tasks: (() => Promise<unknown>)[] = []
  const notify = makeAccountNotifications({ mailer, defer: (t) => tasks.push(t), config: { appUrl: 'https://shop.ci/', contactEmail: 'help@shop.ci' } })
  const flush = () => Promise.all(tasks.map((t) => t()))
  return { notify, mailer, flush }
}

const awa = { email: 'awa@mail.ci', first_name: 'Awa <b>' }

describe('account notifications', () => {
  it('are sent in the background, to the user, with escaped content', async () => {
    const { notify, mailer, flush } = setup()
    notify.login(awa, { ip: '1.2.3.4', userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537' })
    expect(mailer.send).not.toHaveBeenCalled()
    await flush()
    const msg = vi.mocked(mailer.send).mock.calls[0]![0]
    expect(msg.to).toBe('awa@mail.ci')
    expect(msg.html).toContain('Chrome sur Windows')
    expect(msg.html).toContain('1.2.3.4')
    expect(msg.html).toContain('Awa &lt;b&gt;')
    expect(msg.html).not.toContain('Awa <b>')
  })

  it('covers every account event', async () => {
    const { notify, mailer, flush } = setup()
    notify.welcome(awa)
    notify.passwordChanged(awa)
    notify.suspended(awa)
    notify.reactivated(awa)
    notify.roleChanged(awa, 'admin')
    notify.twoFactorReset(awa)
    await flush()
    const subjects = vi.mocked(mailer.send).mock.calls.map((c) => c[0].subject)
    expect(subjects).toEqual([
      'Bienvenue chez SCION CARON ✨',
      'Votre mot de passe a été modifié',
      'Votre compte a été suspendu',
      'Votre compte est de nouveau actif',
      'Vous êtes administrateur de SCION CARON',
      'Double authentification réinitialisée',
    ])
    expect(vi.mocked(mailer.send).mock.calls[2]![0].html).toContain('help@shop.ci')
    expect(vi.mocked(mailer.send).mock.calls[3]![0].html).toContain('https://shop.ci/login')
  })

  it('names the device from the user-agent', () => {
    expect(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Version/17.0 Mobile Safari/604.1')).toBe('Safari sur iPhone / iPad')
    expect(describeDevice('Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36')).toBe('Chrome sur Android')
    expect(describeDevice(null)).toBe('Appareil inconnu')
  })
})
