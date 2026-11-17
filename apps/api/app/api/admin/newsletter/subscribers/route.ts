import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'

export const GET = route(() => useCases.newsletter.listSubscribers(), { auth: 'admin' })
