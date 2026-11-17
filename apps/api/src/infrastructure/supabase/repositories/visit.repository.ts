import type { AudienceStats } from '@trs/shared'
import type { SiteVisit, VisitRepository } from '@/application/ports'
import { db, unwrap } from '../client'

type Stats = Omit<AudienceStats, 'range' | 'from' | 'to' | 'hourly'>

export class SupabaseVisitRepository implements VisitRepository {
  async record(visit: SiteVisit) {
    unwrap(await db().from('site_visits').insert(visit), 'visits.record')
  }

  async stats(from: Date, to: Date, hourly: boolean) {
    const data = unwrap(
      await db().rpc('site_audience_stats', { p_from: from.toISOString(), p_to: to.toISOString(), p_hourly: hourly }),
      'visits.stats',
    ) as Stats
    return data
  }
}
