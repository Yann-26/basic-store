import type { SessionUser } from '@trs/shared'
import { ForbiddenError, NotFoundError, UnauthorizedError } from '@/domain/errors'

/**
 * Central authorization: every permission decision goes through `authorize`.
 *
 * Assurance levels: AAL1 = password or social sign-in, AAL2 = + TOTP / recovery
 * code. `resolveSession` only reports role 'admin' for sessions that passed 2FA,
 * so an admin actor is always AAL2; back-office permissions require it.
 */
export type Action =
  // customer actions on their own objects
  | 'order:read'
  | 'payment:initialize'
  // back-office
  | 'admin:access'
  | 'order:manage'
  | 'payment:read'
  | 'catalog:write'
  | 'media:write'
  | 'settings:write'
  | 'newsletter:manage'
  | 'customer:read'
  | 'user:manage'

export interface Actor {
  id: string
  role: 'customer' | 'admin'
  aal: 1 | 2
}

/** An object owned by a customer account (orders, payments through their order). */
export interface OwnedResource {
  user_id?: string | null
}

const ADMIN_ONLY: ReadonlySet<Action> = new Set([
  'admin:access',
  'order:manage',
  'payment:read',
  'catalog:write',
  'media:write',
  'settings:write',
  'newsletter:manage',
  'customer:read',
  'user:manage',
])
const OWNER_OR_ADMIN: ReadonlySet<Action> = new Set(['order:read', 'payment:initialize'])

export function actorOf(user: SessionUser | null | undefined): Actor | null {
  if (!user) return null
  return { id: user.id, role: user.role, aal: user.role === 'admin' ? 2 : 1 }
}

export function can(actor: Actor | null, action: Action, resource?: OwnedResource | null): boolean {
  if (!actor) return false
  const admin = actor.role === 'admin' && actor.aal === 2
  if (ADMIN_ONLY.has(action)) return admin
  if (OWNER_OR_ADMIN.has(action)) return admin || (!!resource?.user_id && resource.user_id === actor.id)
  return false
}

/**
 * Throws unless `actor` may perform `action` on `resource`.
 * A customer asking for someone else's object gets 404, not 403, so ids cannot be probed.
 */
export function authorize(input: { actor: Actor | null; action: Action; resource?: OwnedResource | null }): void {
  const { actor, action, resource } = input
  if (!actor) throw new UnauthorizedError()
  if (can(actor, action, resource)) return
  if (OWNER_OR_ADMIN.has(action)) throw new NotFoundError('Ressource introuvable')
  throw new ForbiddenError('Accès réservé aux administrateurs')
}
