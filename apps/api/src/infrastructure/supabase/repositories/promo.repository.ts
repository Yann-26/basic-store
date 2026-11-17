import type { PromoCode } from '@trs/shared'
import type { PromoCodeWrite, PromoRepository, ReferralStats } from '@/application/ports'
import { db, safeSearchTerm, unwrap } from '../client'

type Row = Record<string, unknown>

function toPromo(row: Row): PromoCode {
  return {
    ...(row as unknown as PromoCode),
    value: Number(row.value) || 0,
    min_order: Number(row.min_order) || 0,
    max_uses: row.max_uses == null ? null : Number(row.max_uses),
    per_account_limit: Number(row.per_account_limit) || 1,
    uses: Number(row.uses) || 0,
  }
}

export class SupabasePromoRepository implements PromoRepository {
  async list(opts: { source?: PromoCode['source']; search?: string }) {
    let query = db().from('promo_codes').select('*').order('created_at', { ascending: false }).limit(500)
    if (opts.source) query = query.eq('source', opts.source)
    const term = opts.search ? safeSearchTerm(opts.search) : ''
    if (term) query = query.ilike('code', `%${term}%`)
    return ((unwrap(await query, 'promo.list') ?? []) as Row[]).map(toPromo)
  }

  async findById(id: string) {
    const row = unwrap(await db().from('promo_codes').select('*').eq('id', id).maybeSingle(), 'promo.findById')
    return row ? toPromo(row as Row) : null
  }

  async findByCode(code: string) {
    // Codes are stored upper-case; the unique index is on upper(code).
    const row = unwrap(await db().from('promo_codes').select('*').eq('code', code.toUpperCase()).maybeSingle(), 'promo.findByCode')
    return row ? toPromo(row as Row) : null
  }

  async codeExists(code: string, exceptId?: string) {
    let query = db().from('promo_codes').select('id').eq('code', code.toUpperCase()).limit(1)
    if (exceptId) query = query.neq('id', exceptId)
    return ((unwrap(await query, 'promo.codeExists') ?? []) as Row[]).length > 0
  }

  async create(data: PromoCodeWrite) {
    return toPromo(unwrap(await db().from('promo_codes').insert({ ...data, code: data.code.toUpperCase() }).select('*').single(), 'promo.create') as Row)
  }

  async update(id: string, data: Partial<PromoCodeWrite>) {
    const patch = { ...data, ...(data.code ? { code: data.code.toUpperCase() } : {}), updated_at: new Date().toISOString() }
    return toPromo(unwrap(await db().from('promo_codes').update(patch).eq('id', id).select('*').single(), 'promo.update') as Row)
  }

  async delete(id: string) {
    unwrap(await db().from('promo_codes').delete().eq('id', id), 'promo.delete')
  }

  async usesByUser(codeId: string, userId: string) {
    const { count, error } = await db()
      .from('promo_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('promo_code_id', codeId)
      .eq('user_id', userId)
      .is('released_at', null)
    if (error) throw new Error(`[promo.usesByUser] ${error.message}`)
    return count ?? 0
  }

  async redeem(p: { codeId: string; orderId: string; userId: string | null; amount: number }) {
    const ok = unwrap(
      await db().rpc('redeem_promo_code', { p_code_id: p.codeId, p_order_id: p.orderId, p_user_id: p.userId, p_amount: p.amount }),
      'promo.redeem',
    )
    return ok === true
  }

  async release(orderId: string) {
    unwrap(await db().rpc('release_promo_code', { p_order_id: orderId }), 'promo.release')
  }

  async referralCodeOf(userId: string) {
    const row = unwrap(
      await db().from('promo_codes').select('*').eq('source', 'referral').eq('owner_user_id', userId).maybeSingle(),
      'promo.referralCodeOf',
    )
    return row ? toPromo(row as Row) : null
  }

  async rewardsOf(userId: string) {
    const rows = unwrap(
      await db().from('promo_codes').select('*').eq('source', 'reward').eq('owner_user_id', userId).order('created_at', { ascending: false }),
      'promo.rewardsOf',
    )
    return ((rows ?? []) as Row[]).map(toPromo)
  }

  async rewardExistsForOrder(orderId: string) {
    const rows = unwrap(await db().from('promo_codes').select('id').eq('source', 'reward').eq('source_order_id', orderId).limit(1), 'promo.rewardExists')
    return ((rows ?? []) as Row[]).length > 0
  }

  async referredOrders(userId: string) {
    const rows = unwrap(
      await db().from('orders').select('status').eq('referred_by_user_id', userId).neq('status', 'cancelled'),
      'promo.referredOrders',
    ) as { status: string }[] | null
    const list = rows ?? []
    return { orders: list.length, delivered: list.filter((r) => r.status === 'delivered').length }
  }

  async referralStats(): Promise<ReferralStats[]> {
    const orders = (unwrap(
      await db().from('orders').select('referred_by_user_id, status').not('referred_by_user_id', 'is', null).neq('status', 'cancelled').limit(5000),
      'promo.referralStats.orders',
    ) ?? []) as { referred_by_user_id: string; status: string }[]
    const ids = [...new Set(orders.map((o) => o.referred_by_user_id))]
    if (ids.length === 0) return []
    const [users, codes] = await Promise.all([
      db().from('users').select('id, email, first_name, last_name').in('id', ids),
      db().from('promo_codes').select('owner_user_id, code, source').in('owner_user_id', ids).in('source', ['referral', 'reward']),
    ])
    const people = new Map(((unwrap(users, 'promo.referralStats.users') ?? []) as ReferralStats['referrer'][]).map((u) => [u.id, u]))
    const codeRows = (unwrap(codes, 'promo.referralStats.codes') ?? []) as { owner_user_id: string; code: string; source: string }[]
    return ids
      .map((id) => {
        const mine = orders.filter((o) => o.referred_by_user_id === id)
        return {
          referrer: people.get(id) ?? { id, email: '', first_name: '', last_name: '' },
          code: codeRows.find((c) => c.owner_user_id === id && c.source === 'referral')?.code ?? null,
          orders: mine.length,
          delivered: mine.filter((o) => o.status === 'delivered').length,
          rewards: codeRows.filter((c) => c.owner_user_id === id && c.source === 'reward').length,
        }
      })
      .sort((a, b) => b.orders - a.orders)
  }
}
