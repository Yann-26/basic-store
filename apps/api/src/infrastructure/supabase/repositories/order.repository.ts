import { normalizeSizes, type Order, type OrderItem, type OrderPayment, type OrderStatus, type OrderTrackingEntry } from '@trs/shared'
import type { NewOrder, OrderListQuery, OrderRepository } from '@/application/ports'
import { db, safeSearchTerm, unwrap } from '../client'

type Row = Record<string, unknown>

/** The payments an order's detail shows (no customer email). */
const PAYMENTS = 'payments(id, reference, amount, status, kind, method, channel, note, metadata, paid_at, created_at)'

function toOrder(row: Row): Order {
  const items = Array.isArray(row.order_items)
    ? (row.order_items as Row[]).map((i) => ({
        ...(i as unknown as OrderItem),
        product_price: Number(i.product_price) || 0,
        quantity: Number(i.quantity) || 1,
        piece_numbers: Array.isArray(i.piece_numbers) ? (i.piece_numbers as unknown[]).map(Number).filter(Number.isFinite) : [],
        size: i.size == null ? null : normalizeSizes([i.size])[0] ?? null,
      }))
    : undefined
  const tracking = Array.isArray(row.order_tracking)
    ? ([...(row.order_tracking as OrderTrackingEntry[])].sort((a, b) => a.created_at.localeCompare(b.created_at)))
    : undefined
  const payments = Array.isArray(row.payments)
    ? (row.payments as Row[])
        .map((p) => ({ ...(p as unknown as OrderPayment), amount: Number(p.amount) || 0 }))
        .sort((a, b) => (a.paid_at ?? a.created_at).localeCompare(b.paid_at ?? b.created_at))
    : undefined
  return {
    ...(row as unknown as Order),
    total_price: Number(row.total_price) || 0,
    amount_paid: Number(row.amount_paid) || 0,
    deposit_amount: Number(row.deposit_amount) || 0,
    remaining_amount: Number(row.remaining_amount) || 0,
    deposit_percentage: Number(row.deposit_percentage) || 0,
    subtotal_price: row.subtotal_price == null ? null : Number(row.subtotal_price),
    discount_amount: Number(row.discount_amount) || 0,
    order_items: items,
    order_tracking: tracking,
    payments,
  }
}

export class SupabaseOrderRepository implements OrderRepository {
  async create(order: NewOrder, items: Omit<OrderItem, 'id' | 'order_id'>[]) {
    const created = unwrap(await db().from('orders').insert(order).select('*').single(), 'orders.create') as Row
    const orderId = String(created.id)
    const { error } = await db().from('order_items').insert(items.map((i) => ({ ...i, order_id: orderId })))
    if (error) {
      // Keep data consistent: an order without lines is useless.
      await db().from('orders').delete().eq('id', orderId)
      throw new Error(`[orders.createItems] ${error.message}`)
    }
    return toOrder({ ...created, order_items: items })
  }

  async numberExists(preorderNumber: string) {
    const data = unwrap(await db().from('orders').select('id').eq('preorder_number', preorderNumber).limit(1), 'orders.numberExists')
    return (data ?? []).length > 0
  }

  async findById(id: string) {
    const row = unwrap(
      await db().from('orders').select(`*, customers(*), order_items(*), order_tracking(*), ${PAYMENTS}`).eq('id', id).maybeSingle(),
      'orders.findById',
    )
    return row ? toOrder(row as Row) : null
  }

  async findByNumber(preorderNumber: string) {
    const row = unwrap(
      await db()
        .from('orders')
        .select('*, customers(first_name, last_name, phone), order_items(*), order_tracking(*)')
        .eq('preorder_number', preorderNumber)
        .maybeSingle(),
      'orders.findByNumber',
    )
    return row ? toOrder(row as Row) : null
  }

  async list(q: OrderListQuery) {
    let query = db()
      .from('orders')
      .select('*, order_items(*), customers(first_name, last_name, phone, email, city)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((q.page - 1) * q.limit, q.page * q.limit - 1)
    if (q.status) query = query.eq('status', q.status)
    if (q.customerId) query = query.eq('customer_id', q.customerId)
    if (q.search) {
      const term = safeSearchTerm(q.search).toUpperCase()
      if (term) query = query.ilike('preorder_number', `%${term}%`)
    }
    const { data, error, count } = await query
    unwrap({ data, error }, 'orders.list')
    return { items: (data ?? []).map((r) => toOrder(r as Row)), total: count ?? 0 }
  }

  async listForAccount(userId: string, verifiedEmail: string | null) {
    const select = `*, order_items(*), customers(first_name, last_name, phone, email, city), ${PAYMENTS}`
    // Orders placed while signed in, plus older ones made with the same verified email.
    const { data: customers } = verifiedEmail
      ? await db().from('customers').select('id').ilike('email', verifiedEmail.replace(/[%_\\]/g, '\\$&'))
      : { data: [] }
    const customerIds = (customers ?? []).map((c: { id: string }) => c.id)
    let query = db().from('orders').select(select).order('created_at', { ascending: false }).limit(100)
    query = customerIds.length ? query.or(`user_id.eq.${userId},customer_id.in.(${customerIds.join(',')})`) : query.eq('user_id', userId)
    const data = unwrap(await query, 'orders.listForAccount')
    return (data ?? []).map((r) => toOrder(r as Row))
  }

  async update(id: string, patch: Partial<Order>) {
    const row = unwrap(
      await db().from('orders').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select('*').single(),
      'orders.update',
    )
    return toOrder(row as Row)
  }

  async delete(id: string) {
    unwrap(await db().from('order_tracking').delete().eq('order_id', id), 'orders.deleteTracking')
    unwrap(await db().from('order_items').delete().eq('order_id', id), 'orders.deleteItems')
    unwrap(await db().from('orders').delete().eq('id', id), 'orders.delete')
  }

  async addTracking(entry: { order_id: string; status: OrderStatus; notes?: string | null; location?: string | null }) {
    const { error } = await db().from('order_tracking').insert(entry)
    if (error) console.error('[orders.addTracking]', error.message)
  }

  async history(orderId: string) {
    const data = unwrap(
      await db()
        .from('order_tracking')
        .select('id, status, notes, location, created_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true }),
      'orders.history',
    )
    return (data ?? []) as OrderTrackingEntry[]
  }

  async listForAnalytics(from?: string) {
    let query = db()
      .from('orders')
      .select(
        'id, preorder_number, status, total_price, deposit_amount, remaining_amount, amount_paid, payment_status, created_at, customer_id, customers(first_name, last_name), order_items(product_id, product_name, product_price, quantity)',
      )
      .order('created_at', { ascending: false })
      .limit(10000)
    if (from) query = query.gte('created_at', from)
    const data = unwrap(await query, 'orders.analytics')
    return (data ?? []).map((r) => toOrder(r as Row))
  }

  async numberPieces(orderId: string) {
    const rows = unwrap(await db().rpc('number_order_pieces', { p_order_id: orderId }), 'orders.numberPieces') as Row[] | null
    return (rows ?? []).map((r) => ({
      order_item_id: String(r.order_item_id),
      product_id: r.product_id == null ? null : String(r.product_id),
      piece_numbers: Array.isArray(r.piece_numbers) ? (r.piece_numbers as unknown[]).map(Number) : [],
      series_size: r.series_size == null ? null : Number(r.series_size),
    }))
  }

  async applyPayment(orderId: string, amount: number) {
    const rows = unwrap(await db().rpc('apply_order_payment', { p_order_id: orderId, p_amount: amount }), 'orders.applyPayment') as Row[] | null
    const row = rows?.[0]
    return row
      ? { amount_paid: Number(row.amount_paid) || 0, total_price: Number(row.total_price) || 0, payment_status: String(row.payment_status) }
      : null
  }
}
