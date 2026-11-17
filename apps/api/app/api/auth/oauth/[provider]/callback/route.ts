import { NextResponse } from 'next/server'
import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { clearOAuthCookie, OAUTH_COOKIE } from '@/interfaces/http/oauth-cookie'

/** The provider sends the browser back here; we answer with a redirect to the storefront. */
export const GET = route<{ provider: string }>(
  async ({ params, req }) => {
    const q = req.nextUrl.searchParams
    const target = await useCases.social.callback(
      params.provider,
      { code: q.get('code'), state: q.get('state'), error: q.get('error') ?? q.get('error_code') },
      req.cookies.get(OAUTH_COOKIE)?.value,
    )
    return clearOAuthCookie(NextResponse.redirect(target, 302))
  },
  { rateLimit: 30, rateLimitKey: 'oauth-callback' },
)
