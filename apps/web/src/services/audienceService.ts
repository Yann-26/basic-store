import type { AudienceRange, AudienceStats } from '@trs/shared'
import { http, toQuery } from '../core/http'

export const audienceService = {
  getStats(range: AudienceRange, signal?: AbortSignal) {
    return http.get<AudienceStats>(`/admin/audience${toQuery({ range })}`, signal)
  },
}
