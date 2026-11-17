import type { AdminUserQuery, SessionUser } from '@trs/shared'
import type { UserAdminRepository } from '../ports'
import type { AccountNotifications } from '../notifications'
import { ConflictError, NotFoundError, ValidationError } from '@/domain/errors'

/**
 * Back-office account management. Guard rails: an admin can't change their
 * own role or status (no self lock-out), and the last active admin can never
 * be demoted or suspended.
 */
export function makeUserAdminUseCases(d: { userAdmin: UserAdminRepository; notify: AccountNotifications }) {
  async function target(id: string) {
    const user = await d.userAdmin.findById(id)
    if (!user) throw new NotFoundError('Utilisateur introuvable')
    return user
  }

  return {
    async list(query: AdminUserQuery) {
      const [page, stats] = await Promise.all([d.userAdmin.list(query), d.userAdmin.stats()])
      return { ...page, stats }
    },

    async update(actor: SessionUser, id: string, patch: { role?: 'customer' | 'admin'; is_active?: boolean }) {
      if (patch.role === undefined && patch.is_active === undefined) throw new ValidationError('Rien à modifier')
      const user = await target(id)
      if (user.id === actor.id) throw new ValidationError('Vous ne pouvez pas modifier votre propre rôle ou statut')

      const losesAdmin = user.role === 'admin' && user.is_active && (patch.role === 'customer' || patch.is_active === false)
      if (losesAdmin && (await d.userAdmin.countActiveAdmins()) <= 1) {
        throw new ConflictError('Impossible : il doit rester au moins un administrateur actif')
      }
      const updated = await d.userAdmin.update(id, patch)
      // Tell the user what changed.
      if (patch.is_active === false && user.is_active) d.notify.suspended(updated)
      if (patch.is_active === true && !user.is_active) d.notify.reactivated(updated)
      if (patch.role && patch.role !== user.role) d.notify.roleChanged(updated, patch.role)
      return updated
    },

    async resetTwoFactor(actor: SessionUser, id: string) {
      const user = await target(id)
      if (user.id === actor.id) throw new ValidationError('Utilisez Paramètres → Sécurité pour votre propre compte')
      if (user.role !== 'admin') throw new ValidationError("La double authentification ne concerne que les administrateurs")
      await d.userAdmin.resetTwoFactor(id)
      d.notify.twoFactorReset(user)
      return { success: true }
    },
  }
}
