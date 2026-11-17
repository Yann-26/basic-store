import type { NextRequest, NextResponse } from 'next/server'
import { env } from '@/config/env'

/**
 * The session token lives in an HttpOnly cookie: scripts (and therefore XSS)
 * cannot read it. `__Host-` pins it to this exact host, HTTPS and path `/`.
 * Local development runs over plain http, where `__Host-` cookies are refused.
 */
export const SESSION_COOKIE = env.isProduction ? '__Host-trs_session' : 'trs_session'

export function readSessionCookie(req: NextRequest): string | null {
  return req.cookies.get(SESSION_COOKIE)?.value || null
}

export function setSessionCookie(res: NextResponse, token: string, expiresAt: string) {
  const maxAge = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge,
  })
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, secure: env.isProduction, sameSite: 'lax', path: '/', maxAge: 0 })
}

/** A use-case result that opens a session: `{ user, token, expiresAt, ... }`. */
export function isSessionResult(value: unknown): value is { token: string; expiresAt: string; user: unknown } {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.token === 'string' && typeof v.expiresAt === 'string' && typeof v.user === 'object' && v.user !== null
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * CSRF defence for cookie-authenticated requests (on top of SameSite=Lax):
 * a state-changing request must come from one of our origins. Browsers always
 * send Origin on cross-site POST/PUT/DELETE; when it is absent we fall back to
 * Sec-Fetch-Site (same-origin or a direct navigation only).
 */
export function isTrustedOrigin(req: NextRequest, isAllowed: (origin: string) => boolean): boolean {
  if (SAFE_METHODS.has(req.method)) return true
  const origin = req.headers.get('origin')
  if (origin) return isAllowed(origin) || origin === req.nextUrl.origin
  const site = req.headers.get('sec-fetch-site')
  return site === null || site === 'same-origin' || site === 'none'
}
