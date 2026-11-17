import { ACTIVE_ORDER_STATUSES, NEXT_ORDER_STATUS, ORDER_STATUS_LABELS, RECAPTCHA_ACTIONS, type CheckoutPaymentMode, type DeliveryZone, type ManualPaymentMethod, type Order, type OrderStatus } from '@trs/shared'
import { http, toQuery } from '../core/http'
import type { CheckoutCustomer } from '../types/cart'

export type { Order, OrderItem, OrderStatus, OrderTrackingEntry as OrderTracking, Customer } from '@trs/shared'
export { ACTIVE_ORDER_STATUSES, ORDER_STATUS_LABELS }
export const NEXT_STATUS = NEXT_ORDER_STATUS

/** Badge styles per status — gold for the "hot" steps, neutral for the rest. */
export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  confirmed: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
  preparing: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
  out_for_delivery: 'bg-gold/10 text-gold border-gold/30',
  delivered: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/30',
  returned: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
}

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  deposit_paid: 'Payé en partie',
  partial: 'Payé en partie',
  paid: 'Payé',
  refunded: 'Remboursé',
  failed: 'Échoué',
}

export interface CreateOrderResult {
  order_id: string
  customer_id: string
  preorder_number: string
  payment_method: CheckoutPaymentMode
  subtotal_price: number
  discount_amount: number
  delivery_fee: number
  total_price: number
  /** Paid online now (online payment), else 0. */
  due_now: number
  /** Collected by the rider or in the shop. */
  due_on_delivery: number
  promo_code?: string | null
  email_sent: boolean
}

export interface OrdersPage {
  orders: Order[]
  total: number
  page: number
  totalPages: number
}

export const ordersService = {
  /** Public checkout — prices are recomputed by the server. */
  create(input: {
    customer: CheckoutCustomer
    items: { product_id: string; size: string; color?: string; quantity: number }[]
    payment_method: CheckoutPaymentMode
    delivery_zone: DeliveryZone
    promo_code?: string
  }) {
    return http.post<CreateOrderResult>('/orders', input, RECAPTCHA_ACTIONS.checkout)
  },

  async getAll(params: { status?: string; search?: string; page?: number; limit?: number } = {}): Promise<Order[]> {
    return (await ordersService.getPage({ limit: 100, ...params })).orders
  },
  getPage(params: { status?: string; search?: string; page?: number; limit?: number }) {
    return http.get<OrdersPage>(`/admin/orders${toQuery(params)}`)
  },
  getById(id: string) {
    return http.get<Order>(`/admin/orders/${id}`)
  },
  updateStatus(id: string, status: OrderStatus, adminNotes?: string, notifyCustomer = true) {
    return http.put<Order>(`/admin/orders/${id}`, { status, admin_notes: adminNotes, notify_customer: notifyCustomer })
  },
  update(id: string, patch: Partial<Order> & { notify_customer?: boolean; location?: string }) {
    return http.put<Order>(`/admin/orders/${id}`, patch)
  },
  delete(id: string) {
    return http.delete(`/admin/orders/${id}`)
  },
  /** Money received outside the website (cash, Mobile Money to the shop's number…). */
  recordPayment(id: string, input: { amount: number; method: ManualPaymentMethod; note?: string }) {
    return http.post<Order>(`/admin/orders/${id}/payments`, input)
  },
  /** Emails the customer what is left to pay, with the link to pay online. */
  remind(id: string) {
    return http.post<{ sent: boolean; email: string | null; outstanding: number; payUrl: string }>(`/admin/orders/${id}/remind`)
  },
}
