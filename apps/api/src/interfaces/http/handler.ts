import { randomUUID } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { ZodError, type ZodType } from 'zod'
import { RECAPTCHA_HEADER, type SessionUser } from '@trs/shared'
import { AppError, ForbiddenError, TooManyRequestsError, UnauthorizedError, ValidationError } from '@/domain/errors'
import { consume } from '@/infrastructure/security/rate-limiter'
import { repos, services, useCases } from '@/container'
import { refreshBrand } from '@/application/brand'
import { clearSessionCookie, isSessionResult, isTrustedOrigin, readSessionCookie, setSessionCookie } from './session-cookie'
import { isAllowedOrigin } from './origins'
import { actorOf, authorize } from '@/application/authorization'

type Params = Record<string, string>

export interface RequestContext<P extends Params = Params> {
  req: NextRequest
  params: P
  ip: string
  /** Correlates logs, audit rows and error responses. */
  requestId: string
  /** Authenticated user (always set when `auth` is configured). */
  user: SessionUser | null
  /** Parses and validates the JSON body with a zod schema. */
  body<T>(schema: ZodType<T>): Promise<T>
  /** Parses and validates query-string parameters with a zod schema. */
  query<T>(schema: ZodType<T>): T
}

export interface RouteOptions {
  /** 'admin' → admin session (2FA) required; 'user' → any session; undefined → public. */
  auth?: 'admin' | 'user'
  /** Requests allowed per minute per IP (default 120). */
  rateLimit?: number
  /**
   * Bucket name for the rate limit (default: the request path). Set it on routes
   * with dynamic segments, otherwise every id gets its own budget and the limit
   * can be bypassed by enumerating ids.
   */
  rateLimitKey?: string
  /** Sign-in, 2FA, password reset, payments: refuse requests when the shared limiter is unreachable. */
  critical?: boolean
  /** reCAPTCHA v3 action to verify (token from `x-recaptcha-token` header or `recaptchaToken` body field). */
  captcha?: string
  /** Cache-Control for successful GET responses. */
  cache?: string
}

export function clientIp(req: NextRequest): string {
  // x-real-ip is set by the Vercel edge; prefer it over the client-extensible x-forwarded-for
  return req.headers.get('x-real-ip')?.trim() || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

function errorResponse(error: unknown, requestId: string): NextResponse {
  if (error instanceof ZodError) {
    const first = error.issues[0]
    const field = first?.path.join('.')
    return NextResponse.json(
      {
        error: first ? `${field ? `${field} : ` : ''}${first.message}` : 'Données invalides',
        code: 'VALIDATION_ERROR',
        // Paths and messages only: never echo submitted values back.
        issues: error.issues.map((i) => ({ path: i.path, message: i.message })),
        requestId,
      },
      { status: 400 },
    )
  }
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message, code: error.code, requestId }, { status: error.status })
  }
  console.error(
    JSON.stringify({
      level: 'error',
      msg: 'unhandled_error',
      request_id: requestId,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 6).join(' | ') : undefined,
    }),
  )
  return NextResponse.json({ error: 'Erreur interne du serveur', code: 'INTERNAL_ERROR', requestId }, { status: 500 })
}

/** The session comes from the HttpOnly cookie; a Bearer header is still accepted from clients of the previous version. */
async function authenticate(req: NextRequest): Promise<{ user: SessionUser | null; via: 'cookie' | 'bearer' | null; staleCookie: boolean }> {
  const cookie = readSessionCookie(req)
  if (cookie) {
    const user = await useCases.auth.resolveSession(cookie)
    if (user) return { user, via: 'cookie', staleCookie: false }
  }
  const header = req.headers.get('authorization')
  if (header?.startsWith('Bearer ')) {
    const user = await useCases.auth.resolveSession(header.slice(7))
    if (user) return { user, via: 'bearer', staleCookie: Boolean(cookie) }
  }
  return { user: null, via: null, staleCookie: Boolean(cookie) }
}

/**
 * Wraps a route handler with the cross-cutting concerns of the HTTP layer:
 * request id, rate limiting, authentication, CSRF, reCAPTCHA, validation,
 * session cookies, admin audit trail and error mapping.
 */
export function route<P extends Params = Params>(
  handler: (ctx: RequestContext<P>) => Promise<unknown>,
  options: RouteOptions = {},
) {
  return async (req: NextRequest, context: { params: Promise<P> }): Promise<NextResponse> => {
    const started = Date.now()
    const ip = clientIp(req)
    const requestId = randomUUID()
    const path = req.nextUrl.pathname
    let status = 200
    let user: SessionUser | null = null
    let staleCookie = false
    let params = {} as P
    let response: NextResponse
    try {
      const allowed = await consume(`${req.method}:${options.rateLimitKey ?? path}:${ip}`, options.rateLimit ?? 120, 60_000, {
        critical: options.critical,
      })
      if (!allowed) throw new TooManyRequestsError()

      await refreshBrand(() => repos.settings.getAll())
      const session = await authenticate(req)
      user = session.user
      staleCookie = session.staleCookie
      // Cookies ride along with cross-site requests: a mutation must come from our own pages.
      if (session.via === 'cookie' && !isTrustedOrigin(req, isAllowedOrigin)) {
        throw new ForbiddenError('Origine de la requête non autorisée')
      }
      if (options.auth && !user) throw new UnauthorizedError()
      if (options.auth === 'admin') authorize({ actor: actorOf(user), action: 'admin:access' })

      let cachedBody: unknown
      let bodyRead = false
      const readJson = async () => {
        if (!bodyRead) {
          bodyRead = true
          try {
            cachedBody = await req.json()
          } catch {
            throw new ValidationError('Corps JSON invalide')
          }
        }
        return cachedBody
      }

      if (options.captcha) {
        let token = req.headers.get(RECAPTCHA_HEADER)
        if (!token && req.headers.get('content-type')?.includes('application/json')) {
          token = ((await readJson()) as { recaptchaToken?: string } | null)?.recaptchaToken ?? null
        }
        await services.captcha.verify(token, options.captcha, ip)
      }

      params = ((await context?.params) ?? {}) as P
      const ctx: RequestContext<P> = {
        req,
        ip,
        requestId,
        user,
        params,
        body: async (schema) => schema.parse(await readJson()),
        query: (schema) => schema.parse(Object.fromEntries(req.nextUrl.searchParams)),
      }

      let result = await handler(ctx)
      let okStatus = 200
      if (result instanceof Created) {
        okStatus = 201
        result = result.value
      }
      if (result instanceof Response) {
        response = result as NextResponse
      } else if (result === undefined) {
        response = new NextResponse(null, { status: 204 })
      } else if (isSessionResult(result)) {
        // The token goes into the HttpOnly cookie only, never into script-readable JSON.
        const { token, ...body } = result
        response = NextResponse.json(body, { status: okStatus })
        setSessionCookie(response, token, result.expiresAt)
        staleCookie = false
      } else {
        response = NextResponse.json(result, { status: okStatus })
      }
      if (req.method === 'GET' && response.ok && !response.headers.has('Cache-Control')) {
        response.headers.set('Cache-Control', options.cache ?? 'no-store')
      }
    } catch (error) {
      response = errorResponse(error, requestId)
    }

    status = response.status
    response.headers.set('X-Request-Id', requestId)
    if (staleCookie && status !== 401) clearSessionCookie(response)
    if (status === 401 && readSessionCookie(req)) clearSessionCookie(response)

    if (options.auth === 'admin' && user?.role === 'admin' && req.method !== 'GET') {
      await services.audit.record({
        actor_id: user.id,
        actor_email: user.email,
        action: `${req.method} ${path}`,
        method: req.method,
        path,
        resource_id: (params as Params).id ?? null,
        status,
        ip,
        request_id: requestId,
        user_agent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
      })
    }

    if (process.env.NODE_ENV !== 'test') {
      console.log(
        JSON.stringify({
          level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
          msg: 'request',
          request_id: requestId,
          method: req.method,
          path,
          status,
          ms: Date.now() - started,
          user_id: user?.id,
        }),
      )
    }
    return response
  }
}

class Created {
  constructor(readonly value: unknown) {}
}

/** Responds 201 Created with a JSON body (sessions in it still go to the cookie). */
export function created(value: unknown): Created {
  return new Created(value)
}
