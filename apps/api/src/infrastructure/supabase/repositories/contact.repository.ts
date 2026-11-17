import type { ContactMessage, ContactRepository } from '@/application/ports'
import { db, unwrap } from '../client'

export class SupabaseContactRepository implements ContactRepository {
  async saveMessage(msg: Omit<ContactMessage, 'id' | 'status' | 'created_at'>) {
    unwrap(await db().from('contact_messages').insert(msg), 'contact.save')
  }

  async listMessages(opts: { status?: ContactMessage['status'] }) {
    let query = db().from('contact_messages').select('*').order('created_at', { ascending: false }).limit(500)
    if (opts.status) query = query.eq('status', opts.status)
    return (unwrap(await query, 'contact.list') ?? []) as ContactMessage[]
  }

  async updateMessageStatus(id: string, status: ContactMessage['status']) {
    unwrap(await db().from('contact_messages').update({ status }).eq('id', id), 'contact.updateStatus')
  }

  async subscribe(email: string, source: string) {
    // Subscribing again (explicitly) lifts a previous unsubscribe.
    unwrap(await db().from('newsletter_suppressions').delete().eq('email', email), 'newsletter.resubscribe')
    const { error } = await db().from('newsletter_subscribers').insert({ email, source })
    if (error) {
      if (error.code === '23505') {
        unwrap(await db().from('newsletter_subscribers').update({ unsubscribed_at: null }).eq('email', email), 'newsletter.resubscribe')
        return 'exists' as const
      }
      throw new Error(`[newsletter.subscribe] ${error.message}`)
    }
    return 'created' as const
  }
}
