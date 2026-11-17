import { ORDER_STATUSES, paymentProgress, type DashboardAnalytics, type KpiValue, type Order, type Payment } from '@trs/shared'
import type { CustomerRepository, OrderRepository, PaymentRepository, ProductRepository } from '../ports'

export interface DashboardDeps {
  orders: OrderRepository
  customers: CustomerRepository
  products: ProductRepository
  payments: PaymentRepository
}

const DAY = 86_400_000
const IN_PROGRESS = new Set(['confirmed', 'sourcing', 'ordered_supplier', 'shipped_supplier', 'received_warehouse', 'quality_check', 'out_for_delivery'])

function kpi(value: number, previous: number): KpiValue {
  const trend = previous > 0 ? Math.round(((value - previous) / previous) * 100) : value > 0 ? 100 : 0
  return { value, previous, trend: Math.max(-100, Math.min(999, trend)) }
}

/** Value of what was ordered (not what was paid). */
const orderedValueOf = (orders: Order[]) => orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total_price, 0)
const sumOf = (payments: Payment[]) => payments.reduce((s, p) => s + p.amount, 0)

export function makeDashboardUseCases(d: DashboardDeps) {
  return {
    async analytics(days: number): Promise<DashboardAnalytics> {
      const now = Date.now()
      const from = new Date(now - days * DAY)
      const prevFrom = new Date(now - 2 * days * DAY)

      const [allOrders, customersTotal, customersNow, customersPrev, productPage, payments] = await Promise.all([
        d.orders.listForAnalytics(),
        d.customers.count(),
        d.customers.count({ from: from.toISOString() }),
        d.customers.count({ from: prevFrom.toISOString(), to: from.toISOString() }),
        d.products.list({ includeInactive: true, limit: 100, sort: 'newest' }),
        d.payments.listAll(prevFrom.toISOString()),
      ])

      const inRange = (o: Order, a: Date, b: Date) => {
        const t = new Date(o.created_at).getTime()
        return t >= a.getTime() && t < b.getTime()
      }
      const current = allOrders.filter((o) => inRange(o, from, new Date(now + 1)))
      const previous = allOrders.filter((o) => inRange(o, prevFrom, from))
      const currentPaid = current.filter((o) => o.status !== 'cancelled')
      const previousPaid = previous.filter((o) => o.status !== 'cancelled')

      // Real money: successful payments (online or recorded by hand), dated when they were received.
      const successPayments = payments.filter((p) => p.status === 'success')
      const paidAt = (p: Payment) => new Date(p.paid_at ?? p.created_at).getTime()
      const receivedNow = successPayments.filter((p) => paidAt(p) >= from.getTime())
      const receivedPrev = successPayments.filter((p) => paidAt(p) >= prevFrom.getTime() && paidAt(p) < from.getTime())
      const deposit = (p: Payment) => (p.kind ?? 'deposit') === 'deposit'
      const toCheck = payments.filter((p) => p.status === 'pending' && p.method === 'wave' && typeof p.metadata?.declared_at === 'string')

      // ---- time series (daily buckets, monthly for a full year)
      const monthly = days > 120
      const buckets = new Map<string, { revenue: number; orders: number }>()
      const keyOf = (date: Date) => (monthly ? date.toISOString().slice(0, 7) : date.toISOString().slice(0, 10))
      if (monthly) {
        const cursor = new Date(from.getFullYear(), from.getMonth(), 1)
        while (cursor.getTime() <= now) {
          buckets.set(keyOf(new Date(Date.UTC(cursor.getFullYear(), cursor.getMonth(), 15))), { revenue: 0, orders: 0 })
          cursor.setMonth(cursor.getMonth() + 1)
        }
      } else {
        for (let t = from.getTime(); t <= now; t += DAY) buckets.set(keyOf(new Date(t)), { revenue: 0, orders: 0 })
      }
      for (const o of currentPaid) {
        const b = buckets.get(keyOf(new Date(o.created_at)))
        if (b) b.orders += 1
      }
      for (const p of receivedNow) {
        const b = buckets.get(keyOf(new Date(paidAt(p))))
        if (b) b.revenue += p.amount
      }

      // ---- product performance (current range)
      const productsById = new Map(productPage.items.map((p) => [p.id, p]))
      const top = new Map<string, { product_id: string | null; name: string; units: number; revenue: number }>()
      const byCategory = new Map<string, { revenue: number; units: number }>()
      for (const o of currentPaid) {
        for (const item of o.order_items ?? []) {
          const key = item.product_id ?? item.product_name
          const entry = top.get(key) ?? { product_id: item.product_id, name: item.product_name, units: 0, revenue: 0 }
          entry.units += item.quantity
          entry.revenue += item.product_price * item.quantity
          top.set(key, entry)

          const category = (item.product_id && productsById.get(item.product_id)?.category) || 'other'
          const cat = byCategory.get(category) ?? { revenue: 0, units: 0 }
          cat.revenue += item.product_price * item.quantity
          cat.units += item.quantity
          byCategory.set(category, cat)
        }
      }

      const mix = new Map<string, { count: number; amount: number }>()
      for (const p of receivedNow) {
        const channel = (p.method && p.method !== 'paystack' ? p.method : p.channel) || 'autre'
        const m = mix.get(channel) ?? { count: 0, amount: 0 }
        m.count += 1
        m.amount += p.amount
        mix.set(channel, m)
      }

      const statusCount = (s: string) => allOrders.filter((o) => o.status === s).length
      const open = allOrders.filter((o) => o.status !== 'cancelled')
      const unpaidDelivered = allOrders.filter((o) => o.status === 'delivered' && paymentProgress(o).outstanding > 0)

      return {
        range: { from: from.toISOString(), to: new Date(now).toISOString(), days },
        kpis: {
          revenue: kpi(sumOf(receivedNow), sumOf(receivedPrev)),
          orderedValue: kpi(orderedValueOf(current), orderedValueOf(previous)),
          orders: kpi(current.length, previous.length),
          customers: kpi(customersNow, customersPrev),
          averageOrderValue: kpi(
            currentPaid.length ? Math.round(orderedValueOf(currentPaid) / currentPaid.length) : 0,
            previousPaid.length ? Math.round(orderedValueOf(previousPaid) / previousPaid.length) : 0,
          ),
          depositsCollected: kpi(sumOf(receivedNow.filter(deposit)), sumOf(receivedPrev.filter(deposit))),
        },
        totals: {
          orders: allOrders.length,
          customers: customersTotal,
          products: productPage.total,
          activeProducts: productPage.items.filter((p) => p.is_active).length,
          pendingOrders: statusCount('pending'),
          inProgressOrders: allOrders.filter((o) => IN_PROGRESS.has(o.status)).length,
          deliveredOrders: statusCount('delivered'),
          cancelledOrders: statusCount('cancelled'),
          lifetimeRevenue: allOrders.reduce((s, o) => s + paymentProgress(o).paid, 0),
          lifetimeOrdered: orderedValueOf(allOrders),
          outstandingBalance: open.reduce((s, o) => s + paymentProgress(o).outstanding, 0),
          wavePaymentsToCheck: { count: toCheck.length, amount: sumOf(toCheck) },
          unpaidDelivered: {
            count: unpaidDelivered.length,
            amount: unpaidDelivered.reduce((s, o) => s + paymentProgress(o).outstanding, 0),
          },
        },
        salesSeries: [...buckets.entries()].map(([date, v]) => ({ date, ...v })),
        ordersByStatus: ORDER_STATUSES.map((status) => ({ status, count: statusCount(status) })).filter((s) => s.count > 0),
        salesByCategory: [...byCategory.entries()]
          .map(([category, v]) => ({ category, ...v }))
          .sort((a, b) => b.revenue - a.revenue),
        topProducts: [...top.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
        lowStock: productPage.items
          .filter((p) => p.is_active && p.stock <= 3)
          .sort((a, b) => a.stock - b.stock)
          .slice(0, 6)
          .map((p) => ({ id: p.id, name: p.name, slug: p.slug, stock: p.stock, category: p.category })),
        recentOrders: allOrders.slice(0, 8).map((o) => ({
          id: o.id,
          preorder_number: o.preorder_number,
          customer_name: o.customers ? `${o.customers.first_name ?? ''} ${o.customers.last_name ?? ''}`.trim() : 'Client',
          product_name:
            (o.order_items?.[0]?.product_name ?? 'Article') +
            ((o.order_items?.length ?? 0) > 1 ? ` +${(o.order_items?.length ?? 1) - 1}` : ''),
          total_price: o.total_price,
          deposit_amount: o.deposit_amount,
          amount_paid: paymentProgress(o).paid,
          status: o.status,
          payment_status: o.payment_status,
          created_at: o.created_at,
        })),
        paymentMix: [...mix.entries()].map(([channel, v]) => ({ channel, ...v })).sort((a, b) => b.amount - a.amount),
      }
    },
  }
}
