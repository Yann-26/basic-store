import type { NextResponse } from 'next/server'
import { env } from '@/config/env'

/** Binds an OAuth flow to the browser that started it (checked by the callback). */
export const OAUTH_COOKIE = 'trs_oauth'
const PATH = '/api/auth/oauth'

export function setOAuthCookie(res: NextResponse, value: string) {
  // Lax: sent on the provider's top-level redirect back to the callback.
  res.cookies.set(OAUTH_COOKIE, value, { httpOnly: true, secure: env.isProduction, sameSite: 'lax', path: PATH, maxAge: 600 })
  return res
}

export function clearOAuthCookie(res: NextResponse) {
  res.cookies.set(OAUTH_COOKIE, '', { httpOnly: true, secure: env.isProduction, sameSite: 'lax', path: PATH, maxAge: 0 })
  return res
}
