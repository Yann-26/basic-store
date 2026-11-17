import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { SessionUser } from '@trs/shared'

const customer: SessionUser = { id: 'u1', email: 'a@b.ci', first_name: 'A', last_name: 'B', role: 'customer', email_verified: true }
const admin: SessionUser = { ...customer, id: 'adm', role: 'admin' }
const sessions: Record<string, SessionUser> = { 'good-token': customer, 'admin-token': admin }

const audit = vi.fn(async () => {})
vi.mock('@/container', () => ({
  services: { captcha: { verify: vi.fn(async () => {}) }, audit: { record: audit } },
  useCases: { auth: { resolveSession: vi.fn(async (t: string) => sessions[t] ?? null) } },
}))
vi.mock('@/infrastructure/security/rate-limiter', () => ({ consume: vi.fn(async () => true) }))
vi.mock('@/config/env', () => ({
  env: { isProduction: false, appUrl: 'https://shop.test', allowedOrigins: [] },
  allowedOrigins: () => ['https://shop.test'],
}))

const { route, created } = await import('../handler')
const { SESSION_COOKIE } = await import('../session-cookie')

function request(method: string, opts: { cookie?: string; bearer?: string; origin?: string; site?: string } = {}) {
  const headers = new Headers()
  if (opts.cookie) headers.set('cookie', `${SESSION_COOKIE}=${opts.cookie}`)
  if (opts.bearer) headers.set('authorization', `Bearer ${opts.bearer}`)
  if (opts.origin) headers.set('origin', opts.origin)
  if (opts.site) headers.set('sec-fetch-site', opts.site)
  return new NextRequest('https://shop.test/api/x', { method, headers })
}
const ctx = { params: Promise.resolve({ id: 'p1' }) }

beforeEach(() => audit.mockClear())

describe('route wrapper — sessions', () => {
  it('puts a new session in an HttpOnly cookie and never in the JSON body', async () => {
    const handler = route(async () => ({ user: customer, token: 'jwt-value', expiresAt: new Date(Date.now() + 3600_000).toISOString() }))
    const res = await handler(request('POST', { origin: 'https://shop.test' }), ctx)
    const body = await res.json()
    expect(body.token).toBeUndefined()
    expect(body.user.id).toBe('u1')
    const cookie = res.headers.get('set-cookie')!
    expect(cookie).toContain(`${SESSION_COOKIE}=jwt-value`)
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=lax/i)
    expect(cookie).toMatch(/Path=\//)
  })

  it('keeps the 201 status of created() sessions (sign-up)', async () => {
    const handler = route(async () => created({ user: customer, token: 't', expiresAt: new Date(Date.now() + 1000).toISOString() }))
    const res = await handler(request('POST'), ctx)
    expect(res.status).toBe(201)
    expect(res.headers.get('set-cookie')).toContain(SESSION_COOKIE)
  })

  it('authenticates with the cookie', async () => {
    const handler = route(async ({ user }) => ({ id: user!.id }), { auth: 'user' })
    expect(await (await handler(request('GET', { cookie: 'good-token' }), ctx)).json()).toEqual({ id: 'u1' })
  })

  it('still accepts a legacy Bearer token (no forced logout)', async () => {
    const handler = route(async ({ user }) => ({ id: user!.id }), { auth: 'user' })
    expect((await handler(request('GET', { bearer: 'good-token' }), ctx)).status).toBe(200)
  })

  it('refuses anonymous calls and clears an invalid cookie', async () => {
    const handler = route(async () => ({ ok: true }), { auth: 'user' })
    const res = await handler(request('GET', { cookie: 'forged' }), ctx)
    expect(res.status).toBe(401)
    expect(res.headers.get('set-cookie')).toMatch(/Max-Age=0/i)
  })
})

describe('route wrapper — CSRF', () => {
  const mutate = route(async () => ({ ok: true }), { auth: 'user' })

  it('rejects a cookie-authenticated mutation from a foreign origin', async () => {
    const res = await mutate(request('POST', { cookie: 'good-token', origin: 'https://evil.example' }), ctx)
    expect(res.status).toBe(403)
  })

  it('rejects a cross-site mutation without Origin', async () => {
    expect((await mutate(request('POST', { cookie: 'good-token', site: 'cross-site' }), ctx)).status).toBe(403)
  })

  it('accepts same-origin mutations', async () => {
    expect((await mutate(request('POST', { cookie: 'good-token', origin: 'https://shop.test' }), ctx)).status).toBe(200)
    expect((await mutate(request('PUT', { cookie: 'good-token', site: 'same-origin' }), ctx)).status).toBe(200)
  })

  it('reads are not affected', async () => {
    const read = route(async () => ({ ok: true }), { auth: 'user' })
    expect((await read(request('GET', { cookie: 'good-token', origin: 'https://evil.example' }), ctx)).status).toBe(200)
  })
})

describe('route wrapper — admin, errors, audit', () => {
  it('refuses customers on admin routes and does not audit them', async () => {
    const handler = route(async () => ({ ok: true }), { auth: 'admin' })
    expect((await handler(request('DELETE', { cookie: 'good-token', origin: 'https://shop.test' }), ctx)).status).toBe(403)
    expect(audit).not.toHaveBeenCalled()
  })

  it('writes an audit row for admin mutations (no body)', async () => {
    const handler = route(async () => ({ ok: true }), { auth: 'admin' })
    const res = await handler(request('DELETE', { cookie: 'admin-token', origin: 'https://shop.test' }), ctx)
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ actor_id: 'adm', method: 'DELETE', path: '/api/x', resource_id: 'p1', status: 200, request_id: res.headers.get('x-request-id') }),
    )
  })

  it('hides internal errors behind a request id', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const handler = route(async () => {
      throw new Error('relation "users" password_hash leaked?')
    })
    const res = await handler(request('GET'), ctx)
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.error).toBe('Erreur interne du serveur')
    expect(JSON.stringify(body)).not.toContain('password_hash')
    expect(body.requestId).toBe(res.headers.get('x-request-id'))
  })
})
