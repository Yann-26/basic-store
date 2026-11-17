import type { AdminUser, AdminUserQuery } from '@trs/shared'
import type { UserAdminRepository } from '@/application/ports'
import { db, safeSearchTerm, unwrap } from '../client'

// Explicit columns: password hash and 2FA secrets never leave the database.
const COLUMNS = 'id, email, first_name, last_name, phone, role, is_active, last_login, created_at, totp_enabled_at'

type Row = {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  role: string | null
  is_active: boolean | null
  last_login: string | null
  created_at: string
  totp_enabled_at: string | null
}

function toAdminUser(row: Row, stats?: { total_orders: number; total_spent: number }): AdminUser {
  return {
    id: row.id,
    email: row.email,
    first_name: row.first_name,
    last_name: row.last_name,
    phone: row.phone ?? null,
    role: row.role === 'admin' ? 'admin' : 'customer',
    is_active: row.is_active !== false,
    two_factor_enabled: Boolean(row.totp_enabled_at),
    last_login: row.last_login ?? null,
    created_at: row.created_at,
    total_orders: stats?.total_orders ?? 0,
    total_spent: stats?.total_spent ?? 0,
  }
}

export class SupabaseUserAdminRepository implements UserAdminRepository {
  /** Order stats come from the customer record with the same email (case-insensitive). */
  private async withOrderStats(rows: Row[]): Promise<AdminUser[]> {
    const variants = [...new Set(rows.flatMap((r) => [r.email, r.email.toLowerCase()]))]
    const byEmail = new Map<string, { total_orders: number; total_spent: number }>()
    if (variants.length) {
      const { data } = await db().from('customers').select('email, total_orders, total_spent').in('email', variants)
      for (const c of (data ?? []) as { email: string; total_orders: number | null; total_spent: number | null }[]) {
        const key = c.email.toLowerCase()
        const prev = byEmail.get(key) ?? { total_orders: 0, total_spent: 0 }
        byEmail.set(key, { total_orders: prev.total_orders + (Number(c.total_orders) || 0), total_spent: prev.total_spent + (Number(c.total_spent) || 0) })
      }
    }
    return rows.map((r) => toAdminUser(r, byEmail.get(r.email.toLowerCase())))
  }

  async list(q: AdminUserQuery) {
    const limit = Math.min(100, Math.max(1, q.limit ?? 25))
    const page = Math.max(1, q.page ?? 1)
    let query = db().from('users').select(COLUMNS, { count: 'exact' }).order('created_at', { ascending: false })
    if (q.role === 'admin') query = query.eq('role', 'admin')
    if (q.role === 'customer') query = query.or('role.is.null,role.neq.admin')
    if (q.status === 'active') query = query.or('is_active.is.null,is_active.eq.true')
    if (q.status === 'suspended') query = query.eq('is_active', false)
    if (q.search) {
      const term = safeSearchTerm(q.search)
      if (term) query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`)
    }
    const { data, error, count } = await query.range((page - 1) * limit, page * limit - 1)
    unwrap({ data, error }, 'users.adminList')
    return { items: await this.withOrderStats((data ?? []) as Row[]), total: count ?? 0 }
  }

  async stats() {
    const base = () => db().from('users').select('id', { count: 'exact', head: true })
    const count = async (build: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => (await build(base())).count ?? 0
    const [total, admins, suspended] = await Promise.all([count((q) => q), count((q) => q.eq('role', 'admin')), count((q) => q.eq('is_active', false))])
    return { total, admins, suspended }
  }

  async findById(id: string) {
    const row = unwrap(await db().from('users').select(COLUMNS).eq('id', id).maybeSingle(), 'users.adminFind') as Row | null
    return row ? (await this.withOrderStats([row]))[0]! : null
  }

  async countActiveAdmins() {
    const { count } = await db().from('users').select('id', { count: 'exact', head: true }).eq('role', 'admin').or('is_active.is.null,is_active.eq.true')
    return count ?? 0
  }

  async update(id: string, patch: { role?: 'customer' | 'admin'; is_active?: boolean }) {
    // Any role or status change ends the user's open sessions.
    const row = unwrap(
      await db().from('users').update({ ...patch, tokens_valid_after: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id).select(COLUMNS).single(),
      'users.adminUpdate',
    ) as Row
    return (await this.withOrderStats([row]))[0]!
  }

  async resetTwoFactor(id: string) {
    unwrap(
      await db()
        .from('users')
        .update({ totp_secret: null, totp_pending_secret: null, totp_enabled_at: null, totp_last_counter: 0, totp_recovery_codes: [], tokens_valid_after: new Date().toISOString() })
        .eq('id', id),
      'users.resetTwoFactor',
    )
  }
}
