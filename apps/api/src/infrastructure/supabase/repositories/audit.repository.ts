import type { AdminAuditEntry, AuditLogRepository } from '@/application/ports'
import { db } from '../client'

export class SupabaseAuditLogRepository implements AuditLogRepository {
  async record(entry: AdminAuditEntry) {
    const { error } = await db().from('admin_audit_logs').insert(entry)
    // An audit failure must be visible but must not undo the admin's action.
    if (error) console.error(JSON.stringify({ level: 'error', msg: 'audit.write_failed', request_id: entry.request_id, error: error.message }))
  }
}
