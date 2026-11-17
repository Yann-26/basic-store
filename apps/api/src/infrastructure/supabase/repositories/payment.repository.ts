import type { Payment, PaymentStatus } from '@trs/shared'
import type { PaymentRepository } from '@/application/ports'
import { db, unwrap } from '../client'

type Row = Record<string, unknown>

function toPayment(row: Row): Payment {
  const order = row.orders as Row | null | undefined
  return {
    ...(row as unknown as Payment),
    amount: Number(row.amount) || 0,
    orders: order
      ? {
          id: String(order.id),
          preorder_number: String(order.preorder_number ?? ''),
          total_price: Number(order.total_price) || 0,
          customers: (order.customers as { first_name: string; last_name: string } | null) ?? null,
        }
      : null,
  }
}

export class SupabasePaymentRepository implements PaymentRepository {
  async create({ received, method = 'paystack', ...payment }: Parameters<PaymentRepository['create']>[0]) {
    const now = new Date().toISOString()
    unwrap(
      await db()
        .from('payments')
        .insert({ ...payment, method, ...(received ? { status: 'success', ...received } : { status: 'pending' }), created_at: now, updated_at: now }),
      'payments.create',
    )
  }

  async findByReference(reference: string) {
    const row = unwrap(await db().from('payments').select('*').eq('reference', reference).maybeSingle(), 'payments.find')
    return row ? toPayment(row as Row) : null
  }

  async findOpenForOrder(orderId: string, since: string) {
    const row = unwrap(
      await db()
        .from('payments')
        .select('*')
        .eq('order_id', orderId)
        .eq('status', 'pending')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      'payments.findOpen',
    )
    return row ? (toPayment(row as Row) as Payment & { metadata?: Record<string, unknown> | null }) : null
  }

  async transition(reference: string, from: PaymentStatus[], patch: Partial<Payment> & { status: PaymentStatus; error_message?: string; recorded_by?: string }) {
    const rows = unwrap(
      await db()
        .from('payments')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('reference', reference)
        .in('status', from)
        .select('id'),
      'payments.transition',
    )
    return (rows ?? []).length > 0
  }

  async update(reference: string, patch: Partial<Payment> & { error_message?: string; metadata?: Record<string, unknown> }) {
    unwrap(
      await db().from('payments').update({ ...patch, updated_at: new Date().toISOString() }).eq('reference', reference),
      'payments.update',
    )
  }

  async list(opts: { status?: PaymentStatus; orderId?: string; page: number; limit: number }) {
    let query = db()
      .from('payments')
      .select('*, orders(id, preorder_number, total_price, customers(first_name, last_name))', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((opts.page - 1) * opts.limit, opts.page * opts.limit - 1)
    if (opts.status) query = query.eq('status', opts.status)
    if (opts.orderId) query = query.eq('order_id', opts.orderId)
    const { data, error, count } = await query
    unwrap({ data, error }, 'payments.list')
    return { items: (data ?? []).map((r) => toPayment(r as Row)), total: count ?? 0 }
  }

  async listAll(from?: string) {
    let query = db().from('payments').select('status, amount, channel, method, kind, metadata, paid_at, created_at').limit(10000)
    if (from) query = query.gte('created_at', from)
    return ((unwrap(await query, 'payments.listAll') ?? []) as Row[]).map(toPayment)
  }
}
