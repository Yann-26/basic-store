import type { Order, Payment, PaymentKind } from '@trs/shared'
import { http, toQuery } from '../core/http'

export type { Payment } from '@trs/shared'

export interface PaymentsResponse {
  payments: Payment[]
  total: number
  page: number
  totalPages: number
  stats: {
    totalRevenue: number
    totalPending: number
    totalSuccess: number
    totalFailed: number
    totalRefunded: number
    total: number
  }
}

export interface PaymentStart {
  reference: string
  amount: number
  kind: PaymentKind
  /** The Paystack checkout page to send the customer to. */
  authorization_url: string
}

export interface PaymentVerification {
  /** success: credited · review: paid but being checked by the shop · anything else: not paid. */
  status: 'success' | 'review' | 'failed' | 'abandoned' | 'pending' | string
  reference: string
  amount: number
  kind: PaymentKind
  preorder_number: string | null
  first_name: string | null
}

export const paymentService = {
  /** Opens the Paystack checkout for what the order still needs; the amount is decided by the API. */
  initialize(params: { orderId: string }) {
    return http.post<PaymentStart>('/payments/initialize', params)
  },
  /** Back from Paystack: the API asks Paystack whether the payment went through. */
  verify(reference: string) {
    return http.post<PaymentVerification>('/payments/verify', { reference })
  },
  /** Admin: an older Wave payment is in the Wave Business app. */
  confirm(reference: string) {
    return http.post<Order>(`/admin/payments/${encodeURIComponent(reference)}/confirm`)
  },
  /** Admin: no such older Wave payment. */
  reject(reference: string, reason?: string) {
    return http.post<Order>(`/admin/payments/${encodeURIComponent(reference)}/reject`, { reason: reason || undefined })
  },
  getAll(params: { status?: string; page?: number; limit?: number } = {}) {
    return http.get<PaymentsResponse>(`/admin/payments${toQuery(params)}`)
  },
}
