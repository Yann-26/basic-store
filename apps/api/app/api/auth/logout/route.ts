import { NextResponse } from 'next/server'
import { route } from '@/interfaces/http/handler'
import { clearSessionCookie } from '@/interfaces/http/session-cookie'

/** Removes the session cookie (the browser cannot delete an HttpOnly cookie itself). */
export const POST = route(async () => {
  const res = new NextResponse(null, { status: 204 })
  clearSessionCookie(res)
  return res
}, { rateLimit: 30 })
