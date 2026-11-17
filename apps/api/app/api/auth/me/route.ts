import { route } from '@/interfaces/http/handler'

export const GET = route(async ({ user }) => ({ user }), { auth: 'user' })
