import type { Customer } from '@trs/shared'
import type { CustomerRepository, CustomerWrite, OrderRepository } from '../ports'
import { NotFoundError } from '@/domain/errors'

export function makeCustomerUseCases(d: { customers: CustomerRepository; orders: OrderRepository }) {
  return {
    list(search?: string) {
      return d.customers.list({ search })
    },

    async get(id: string): Promise<Customer> {
      const customer = await d.customers.findById(id)
      if (!customer) throw new NotFoundError('Client introuvable')
      return customer
    },

    async update(id: string, patch: Partial<CustomerWrite>) {
      if (!(await d.customers.findById(id))) throw new NotFoundError('Client introuvable')
      return d.customers.update(id, patch)
    },

    async orders(id: string) {
      if (!(await d.customers.findById(id))) throw new NotFoundError('Client introuvable')
      const { items } = await d.orders.list({ customerId: id, page: 1, limit: 100 })
      return items
    },
  }
}
