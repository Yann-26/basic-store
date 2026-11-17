import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { adminUserUpdateSchema, uuidParam } from '@/interfaces/http/schemas'

/** Suspend / reactivate an account or change its role (ends its open sessions). */
export const PATCH = route<{ id: string }>(
  async ({ params, body, user }) => useCases.users.update(user!, uuidParam.parse(params).id, await body(adminUserUpdateSchema)),
  { auth: 'admin', rateLimit: 30, rateLimitKey: 'admin-users-update' },
)
