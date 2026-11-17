import type { AdminUser, AdminUserQuery, AdminUserStats } from '@trs/shared'
import { http, toQuery } from '../core/http'

export type { AdminUser } from '@trs/shared'

export interface AdminUserPage {
  items: AdminUser[]
  total: number
  stats: AdminUserStats
}

/** Back-office account management (all users, not only buyers). */
export const usersService = {
  list(query: AdminUserQuery = {}, signal?: AbortSignal) {
    return http.get<AdminUserPage>(`/admin/users${toQuery({ ...query })}`, signal)
  },
  update(id: string, patch: { role?: 'customer' | 'admin'; is_active?: boolean }) {
    return http.patch<AdminUser>(`/admin/users/${id}`, patch)
  },
  resetTwoFactor(id: string) {
    return http.post<{ success: boolean }>(`/admin/users/${id}/reset-2fa`)
  },
}
