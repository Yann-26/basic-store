import type { Customer as BaseCustomer, Order } from '@trs/shared'
import { http, toQuery } from '../core/http'

export type Customer = BaseCustomer & { total_orders: number; total_spent: number; created_at: string }
export type CustomerOrder = Pick<Order, 'id' | 'preorder_number' | 'status' | 'total_price' | 'deposit_amount' | 'created_at'>

export const customersService = {
  getAll(params: { search?: string } = {}) {
    return http.get<Customer[]>(`/admin/customers${toQuery(params)}`)
  },
  getById(id: string) {
    return http.get<Customer>(`/admin/customers/${id}`)
  },
  update(id: string, data: Partial<Customer>) {
    const { id: _id, created_at: _c, updated_at: _u, total_orders: _o, total_spent: _s, ...patch } = data
    return http.put<Customer>(`/admin/customers/${id}`, patch)
  },
  getOrders(customerId: string) {
    return http.get<CustomerOrder[]>(`/admin/customers/${customerId}/orders`)
  },
}
