import type { Drop } from '@trs/shared'
import type { DropRepository, DropWrite } from '@/application/ports'
import { db, unwrap } from '../client'

type Row = Record<string, unknown>

function toDrop(row: Row): Drop {
  const { drop_reminders, ...rest } = row
  const counted = Array.isArray(drop_reminders) ? Number((drop_reminders[0] as { count?: number } | undefined)?.count ?? 0) : undefined
  return { ...(rest as unknown as Drop), preorders_open: row.preorders_open !== false, product_ids: (row.product_ids as string[] | null) ?? [], ...(counted === undefined ? {} : { reminders: counted }) }
}

export class SupabaseDropRepository implements DropRepository {
  async list(opts: { publishedOnly: boolean; from?: string }) {
    let query = db()
      .from('drops')
      .select(opts.publishedOnly ? '*' : '*, drop_reminders(count)')
      .order('starts_at', { ascending: true })
      .limit(200)
    if (opts.publishedOnly) query = query.eq('is_published', true)
    if (opts.from) query = query.gte('starts_at', opts.from)
    return ((unwrap(await query, 'drops.list') ?? []) as unknown as Row[]).map(toDrop)
  }

  async findById(id: string) {
    const row = unwrap(await db().from('drops').select('*').eq('id', id).maybeSingle(), 'drops.findById')
    return row ? toDrop(row as Row) : null
  }

  async create(data: DropWrite) {
    return toDrop(unwrap(await db().from('drops').insert(data).select('*').single(), 'drops.create') as Row)
  }

  async update(id: string, patch: Partial<DropWrite>) {
    // A new date means the reminders are sent again at the new opening.
    const extra = patch.starts_at ? { reminded_at: null, early_reminded_at: null } : {}
    return toDrop(
      unwrap(await db().from('drops').update({ ...patch, ...extra, updated_at: new Date().toISOString() }).eq('id', id).select('*').single(), 'drops.update') as Row,
    )
  }

  async delete(id: string) {
    unwrap(await db().from('drops').delete().eq('id', id), 'drops.delete')
  }

  async addReminder(dropId: string, email: string) {
    const { error } = await db().from('drop_reminders').insert({ drop_id: dropId, email: email.toLowerCase() })
    if (!error) return true
    if (error.code === '23505') return false
    throw new Error(`[drops.addReminder] ${error.message}`)
  }

  async dueReminders(now: string, limit: number) {
    const drops = ((unwrap(
      await db().from('drops').select('*').eq('is_published', true).lte('starts_at', now).is('reminded_at', null).order('starts_at').limit(5),
      'drops.due',
    ) ?? []) as Row[]).map(toDrop)
    const out: { drop: Drop; reminders: { id: string; email: string }[] }[] = []
    for (const drop of drops) {
      const reminders = (unwrap(
        await db().from('drop_reminders').select('id, email').eq('drop_id', drop.id).is('notified_at', null).limit(limit),
        'drops.dueReminders',
      ) ?? []) as { id: string; email: string }[]
      if (reminders.length === 0) {
        // Everyone was warned: the drop is done.
        unwrap(await db().from('drops').update({ reminded_at: now }).eq('id', drop.id), 'drops.markDone')
        continue
      }
      out.push({ drop, reminders })
    }
    return out
  }

  async upcoming(now: string) {
    const rows = unwrap(await db().from('drops').select('*').eq('is_published', true).gt('starts_at', now).order('starts_at').limit(50), 'drops.upcoming')
    return ((rows ?? []) as Row[]).map(toDrop)
  }

  async hasEarlyAccess(dropId: string, email: string, before: string) {
    const address = email.trim().toLowerCase()
    if (!address) return false
    const { count: reminders } = await db()
      .from('drop_reminders')
      .select('id', { count: 'exact', head: true })
      .eq('drop_id', dropId)
      .eq('email', address)
      .lt('created_at', before)
    if ((reminders ?? 0) > 0) return true
    // Newsletter addresses may be stored with capitals: compare case-insensitively (no wildcards).
    const exact = address.replace(/[\\%_]/g, (c) => `\\${c}`)
    const { count: subscribed } = await db()
      .from('newsletter_subscribers')
      .select('id', { count: 'exact', head: true })
      .ilike('email', exact)
      .is('unsubscribed_at', null)
      .lt('created_at', before)
    return (subscribed ?? 0) > 0
  }

  async dueEarlyAccess(now: string, hours: number, limit: number) {
    if (hours <= 0) return []
    const until = new Date(new Date(now).getTime() + hours * 3_600_000).toISOString()
    const drops = ((unwrap(
      await db().from('drops').select('*').eq('is_published', true).eq('preorders_open', false).gt('starts_at', now).lte('starts_at', until).is('early_reminded_at', null).order('starts_at').limit(5),
      'drops.dueEarly',
    ) ?? []) as Row[]).map(toDrop)
    const out: { drop: Drop; reminders: { id: string; email: string }[] }[] = []
    for (const drop of drops) {
      // Only the people who asked before the early window opened.
      const opensAt = new Date(new Date(drop.starts_at).getTime() - hours * 3_600_000).toISOString()
      const reminders = (unwrap(
        await db().from('drop_reminders').select('id, email').eq('drop_id', drop.id).is('early_notified_at', null).lt('created_at', opensAt).limit(limit),
        'drops.dueEarlyReminders',
      ) ?? []) as { id: string; email: string }[]
      if (reminders.length === 0) {
        unwrap(await db().from('drops').update({ early_reminded_at: now }).eq('id', drop.id), 'drops.markEarlyDone')
        continue
      }
      out.push({ drop, reminders })
    }
    return out
  }

  async markEarlyNotified(reminderIds: string[]) {
    if (reminderIds.length === 0) return
    unwrap(await db().from('drop_reminders').update({ early_notified_at: new Date().toISOString() }).in('id', reminderIds), 'drops.markEarlyNotified')
  }

  async markReminded(reminderIds: string[]) {
    if (reminderIds.length === 0) return
    unwrap(await db().from('drop_reminders').update({ notified_at: new Date().toISOString() }).in('id', reminderIds), 'drops.markReminded')
  }
}
