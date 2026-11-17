import type { SettingsRepository } from '@/application/ports'
import { db, unwrap } from '../client'

function parse(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

export class SupabaseSettingsRepository implements SettingsRepository {
  async getAll() {
    const rows = unwrap(await db().from('settings').select('key, value'), 'settings.getAll') ?? []
    return Object.fromEntries(rows.map((r: { key: string; value: unknown }) => [r.key, parse(r.value)]))
  }

  async upsertMany(entries: { key: string; value: unknown }[]) {
    if (entries.length === 0) return
    const now = new Date().toISOString()
    unwrap(
      await db()
        .from('settings')
        .upsert(entries.map(({ key, value }) => ({ key, value: JSON.stringify(value), updated_at: now })), { onConflict: 'key' }),
      'settings.upsert',
    )
  }
}
