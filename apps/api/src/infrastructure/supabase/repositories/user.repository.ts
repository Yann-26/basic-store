import { randomBytes } from 'node:crypto'
import type { SessionUser } from '@trs/shared'
import type { AccountState, TwoFactorState, UserRepository } from '@/application/ports'
import { db } from '../client'

type RpcUser = { id: string; email: string; first_name: string; last_name: string; phone?: string | null; role?: string }

function toSessionUser(u: RpcUser): SessionUser {
  return {
    id: u.id,
    email: u.email,
    first_name: u.first_name,
    last_name: u.last_name,
    phone: u.phone ?? null,
    role: u.role === 'admin' ? 'admin' : 'customer',
  }
}

/** Users live in `public.users`; password hashing is done by the SQL functions. */
export class SupabaseUserRepository implements UserRepository {
  async authenticate(email: string, password: string) {
    const { data, error } = await db().rpc('authenticate_user', { user_email: email, user_password: password })
    if (error) throw new Error(`[users.authenticate] ${error.message}`)
    if (!data?.success || !data.user) return { user: null, message: data?.message as string | undefined }
    return { user: toSessionUser(data.user as RpcUser) }
  }

  async emailExists(email: string) {
    const { data } = await db().from('users').select('id').eq('email', email).limit(1)
    return (data ?? []).length > 0
  }

  async create(input: { email: string; password: string; firstName: string; lastName: string; phone: string | null }) {
    const { data, error } = await db().rpc('create_user', {
      user_email: input.email,
      user_password: input.password,
      user_first_name: input.firstName,
      user_last_name: input.lastName,
      user_phone: input.phone,
    })
    if (error) throw new Error(`[users.create] ${error.message}`)
    if (!data?.success || !data.user) throw new Error(`[users.create] ${data?.message ?? 'unknown error'}`)
    return toSessionUser({ ...(data.user as RpcUser), phone: input.phone })
  }

  async getAccountState(userId: string): Promise<AccountState | null> {
    const { data, error } = await db().from('users').select('role, is_active, tokens_valid_after, email_verified_at').eq('id', userId).maybeSingle()
    if (error) throw new Error(`[users.getAccountState] ${error.message}`)
    if (!data) return null
    return {
      role: data.role === 'admin' ? 'admin' : 'customer',
      isActive: data.is_active !== false,
      tokensValidAfter: data.tokens_valid_after ?? '1970-01-01T00:00:00Z',
      emailVerified: Boolean(data.email_verified_at),
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const { data, error } = await db().rpc('change_user_password', {
      p_user_id: userId,
      p_current_password: currentPassword,
      p_new_password: newPassword,
    })
    if (error) throw new Error(`[users.changePassword] ${error.message}`)
    return { success: Boolean(data?.success), message: data?.message as string | undefined }
  }

  async getSessionUser(userId: string) {
    const { data, error } = await db().from('users').select('id, email, first_name, last_name, phone, role, is_active').eq('id', userId).maybeSingle()
    if (error) throw new Error(`[users.getSessionUser] ${error.message}`)
    return data && data.is_active !== false ? toSessionUser(data as RpcUser) : null
  }

  async getTwoFactor(userId: string): Promise<TwoFactorState | null> {
    const { data, error } = await db()
      .from('users')
      .select('totp_secret, totp_pending_secret, totp_enabled_at, totp_last_counter, totp_recovery_codes')
      .eq('id', userId)
      .maybeSingle()
    if (error) throw new Error(`[users.getTwoFactor] ${error.message}`)
    if (!data) return null
    return {
      secret: data.totp_secret ?? null,
      pendingSecret: data.totp_pending_secret ?? null,
      enabledAt: data.totp_enabled_at ?? null,
      lastCounter: Number(data.totp_last_counter) || 0,
      recoveryHashes: (data.totp_recovery_codes as string[] | null) ?? [],
    }
  }

  async savePendingTotp(userId: string, sealedSecret: string) {
    const { error } = await db().from('users').update({ totp_pending_secret: sealedSecret }).eq('id', userId)
    if (error) throw new Error(`[users.savePendingTotp] ${error.message}`)
  }

  async enableTotp(userId: string, sealedSecret: string, recoveryHashes: string[]) {
    const { error } = await db()
      .from('users')
      .update({ totp_secret: sealedSecret, totp_pending_secret: null, totp_enabled_at: new Date().toISOString(), totp_last_counter: 0, totp_recovery_codes: recoveryHashes })
      .eq('id', userId)
    if (error) throw new Error(`[users.enableTotp] ${error.message}`)
  }

  async advanceTotpCounter(userId: string, counter: number) {
    // Conditional update: two requests with the same code can't both succeed.
    const { data, error } = await db().from('users').update({ totp_last_counter: counter }).eq('id', userId).lt('totp_last_counter', counter).select('id')
    if (error) throw new Error(`[users.advanceTotpCounter] ${error.message}`)
    return (data ?? []).length > 0
  }

  async consumeRecoveryCode(userId: string, hash: string) {
    const state = await this.getTwoFactor(userId)
    if (!state?.recoveryHashes.includes(hash)) return false
    const remaining = state.recoveryHashes.filter((h) => h !== hash)
    const { data, error } = await db()
      .from('users')
      .update({ totp_recovery_codes: remaining })
      .eq('id', userId)
      .contains('totp_recovery_codes', [hash])
      .select('id')
    if (error) throw new Error(`[users.consumeRecoveryCode] ${error.message}`)
    return (data ?? []).length > 0
  }

  async setRecoveryCodes(userId: string, hashes: string[]) {
    const { error } = await db().from('users').update({ totp_recovery_codes: hashes }).eq('id', userId)
    if (error) throw new Error(`[users.setRecoveryCodes] ${error.message}`)
  }

  async findActiveByEmail(email: string) {
    const { data, error } = await db()
      .from('users')
      .select('id, email, first_name, last_name, phone, role, is_active')
      .ilike('email', email.trim().replace(/[%_\\]/g, '\\$&'))
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(`[users.findActiveByEmail] ${error.message}`)
    return data ? toSessionUser(data as RpcUser) : null
  }

  async markEmailVerified(userId: string) {
    const { error } = await db().from('users').update({ email_verified_at: new Date().toISOString() }).eq('id', userId).is('email_verified_at', null)
    if (error) throw new Error(`[users.markEmailVerified] ${error.message}`)
  }

  async resetPassword(userId: string, newPassword: string) {
    const { data, error } = await db().rpc('reset_user_password', { p_user_id: userId, p_new_password: newPassword })
    if (error) throw new Error(`[users.resetPassword] ${error.message}`)
    return { success: Boolean(data?.success), message: data?.message as string | undefined }
  }

  async updateProfile(userId: string, patch: { first_name: string; last_name: string; phone: string | null }) {
    const { data, error } = await db()
      .from('users')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('id, email, first_name, last_name, phone, role')
      .single()
    if (error) throw new Error(`[users.updateProfile] ${error.message}`)
    return toSessionUser(data as RpcUser)
  }

  async createSocial(input: { email: string; firstName: string; lastName: string; emailVerified: boolean }) {
    // Unusable random password: the user can choose a real one via "Mot de passe oublié".
    const user = await this.create({ email: input.email, password: randomBytes(32).toString('base64url'), firstName: input.firstName, lastName: input.lastName, phone: null })
    const { error } = await db()
      .from('users')
      .update({ password_set: false, ...(input.emailVerified ? { email_verified_at: new Date().toISOString() } : {}) })
      .eq('id', user.id)
    if (error) throw new Error(`[users.createSocial] ${error.message}`)
    return user
  }

  async hasPassword(userId: string) {
    const { data, error } = await db().from('users').select('password_set').eq('id', userId).maybeSingle()
    if (error) throw new Error(`[users.hasPassword] ${error.message}`)
    return data?.password_set !== false
  }
}
