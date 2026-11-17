import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { messageStatusSchema, uuidParam } from '@/interfaces/http/schemas'

export const PUT = route<{ id: string }>(async ({ params, body }) => {
  await useCases.engagement.updateMessageStatus(uuidParam.parse(params).id, (await body(messageStatusSchema)).status)
  return { success: true }
}, { auth: 'admin' })
