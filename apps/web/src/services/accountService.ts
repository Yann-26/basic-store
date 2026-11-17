import type { ClientSession, Order } from '@trs/shared'
import { http } from '../core/http'

/** "Mon compte": the signed-in customer's own data. */
export const accountService = {
  orders() {
    return http.get<Order[]>('/account/orders')
  },
  updateProfile(data: { first_name: string; last_name: string; phone: string }) {
    return http.put<ClientSession>('/account/profile', data)
  },
}
