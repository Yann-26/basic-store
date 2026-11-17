import type { Customer } from '@trs/shared'
import type { CustomerRepository, CustomerWrite } from '@/application/ports'
import { db, safeSearchTerm, unwrap } from '../client'

export class SupabaseCustomerRepository implements CustomerRepository {
  async list(opts: { search?: string }) {
    let query = db().from('customers').select('*').order('created_at', { ascending: false }).limit(500)
    if (opts.search) {
      const term = safeSearchTerm(opts.search)
      if (term) {
        query = query.or(
          `first_name.ilike.%${term}%,last_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%,city.ilike.%${term}%`,
        )
      }
    }
    return (unwrap(await query, 'customers.list') ?? []) as Customer[]
  }

  async findById(id: string) {
    return unwrap(await db().from('customers').select('*').eq('id', id).maybeSingle(), 'customers.findById') as Customer | null
  }

  async findByPhone(phone: string) {
    return unwrap(await db().from('customers').select('*').eq('phone', phone).limit(1).maybeSingle(), 'customers.findByPhone') as Customer | null
  }

  async findByEmail(email: string) {
    return unwrap(await db().from('customers').select('*').eq('email', email).limit(1).maybeSingle(), 'customers.findByEmail') as Customer | null
  }

  async create(data: CustomerWrite) {
    return unwrap(await db().from('customers').insert(data).select('*').single(), 'customers.create') as Customer
  }

  async update(id: string, data: Partial<CustomerWrite>) {
    return unwrap(
      await db().from('customers').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select('*').single(),
      'customers.update',
    ) as Customer
  }

  async count(opts: { from?: string; to?: string } = {}) {
    let query = db().from('customers').select('id', { count: 'exact', head: true })
    if (opts.from) query = query.gte('created_at', opts.from)
    if (opts.to) query = query.lt('created_at', opts.to)
    const { count, error } = await query
    if (error) throw new Error(`[customers.count] ${error.message}`)
    return count ?? 0
  }
}
