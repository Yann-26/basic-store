import type { SessionUser } from '@trs/shared'
import type { Mailer } from './ports'
import {
  accountReactivatedEmail,
  accountSuspendedEmail,
  describeDevice,
  loginAlertEmail,
  passwordChangedEmail,
  passwordResetEmail,
  roleChangedEmail,
  twoFactorResetEmail,
  verifyEmailEmail,
  welcomeEmail,
} from './templates/emails'
import { brand } from './brand'

/** Runs a task after the response is sent. */
export type Defer = (task: () => Promise<unknown>) => void

export interface NotificationDeps {
  mailer: Mailer
  defer: Defer
  config: { appUrl: string; contactEmail: string }
}

type Person = Pick<SessionUser, 'email' | 'first_name'>
export interface RequestMeta {
  ip?: string | null
  userAgent?: string | null
}

/**
 * Account emails. Each one is sent in the background and never fails the
 * action that triggered it (the mailer logs and swallows errors).
 */
export function makeAccountNotifications({ mailer, defer, config }: NotificationDeps) {
  const url = (path: string) => `${config.appUrl.replace(/\/$/, '')}${path}`
  const send = (to: string, subject: string, html: string) => defer(() => mailer.send({ to, subject, html }))

  return {
    welcome(user: Person, verifyToken?: string) {
      const verifyUrl = verifyToken ? url(`/verify-email?token=${encodeURIComponent(verifyToken)}`) : undefined
      send(user.email, `Bienvenue chez ${brand().name} ✨`, welcomeEmail({ firstName: user.first_name, shopUrl: url('/collection'), verifyUrl }))
    },
    verifyEmail(user: Person, token: string) {
      send(user.email, 'Confirmez votre adresse email', verifyEmailEmail({ firstName: user.first_name, verifyUrl: url(`/verify-email?token=${encodeURIComponent(token)}`) }))
    },
    passwordReset(user: Person, token: string) {
      send(user.email, 'Réinitialisez votre mot de passe', passwordResetEmail({ firstName: user.first_name, resetUrl: url(`/reset-password?token=${encodeURIComponent(token)}`) }))
    },
    login(user: Person, meta: RequestMeta, opts: { admin?: boolean } = {}) {
      send(
        user.email,
        opts.admin ? 'Connexion à l’espace administration' : 'Nouvelle connexion à votre compte',
        loginAlertEmail({
          firstName: user.first_name,
          at: new Date(),
          device: describeDevice(meta.userAgent),
          ip: meta.ip || 'inconnue',
          securityUrl: url(opts.admin ? '/admin/settings' : '/login'),
          admin: opts.admin,
        }),
      )
    },
    passwordChanged(user: Person) {
      send(user.email, 'Votre mot de passe a été modifié', passwordChangedEmail({ firstName: user.first_name, at: new Date(), contactEmail: config.contactEmail }))
    },
    suspended(user: Person) {
      send(user.email, 'Votre compte a été suspendu', accountSuspendedEmail({ firstName: user.first_name, contactEmail: config.contactEmail }))
    },
    reactivated(user: Person) {
      send(user.email, 'Votre compte est de nouveau actif', accountReactivatedEmail({ firstName: user.first_name, loginUrl: url('/login') }))
    },
    roleChanged(user: Person, role: 'admin' | 'customer') {
      send(
        user.email,
        role === 'admin' ? `Vous êtes administrateur de ${brand().name}` : 'Vos droits d’administrateur ont été retirés',
        roleChangedEmail({ firstName: user.first_name, role, url: url('/admin/login') }),
      )
    },
    twoFactorReset(user: Person) {
      send(user.email, 'Double authentification réinitialisée', twoFactorResetEmail({ firstName: user.first_name, adminLoginUrl: url('/admin/login') }))
    },
  }
}

export type AccountNotifications = ReturnType<typeof makeAccountNotifications>
