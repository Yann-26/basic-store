import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { dropReminderSchema } from '@/interfaces/http/schemas'
import { RECAPTCHA_ACTIONS } from '@trs/shared'

/** "Prévenez-moi": one email when the drop opens. */
export const POST = route<{ id: string }>(
  async ({ params, body }) => useCases.drops.remind(params.id, (await body(dropReminderSchema)).email),
  { rateLimit: 5, captcha: RECAPTCHA_ACTIONS.dropReminder },
)
