import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'

export const GET = route(({ req }) => {
  const status = req.nextUrl.searchParams.get('status')
  return useCases.engagement.listMessages(status === 'new' || status === 'read' || status === 'archived' ? status : undefined)
}, { auth: 'admin' })
