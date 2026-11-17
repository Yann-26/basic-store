import { NextResponse } from 'next/server'
import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { OAuthFlowError } from '@/application/use-cases/social'
import { setOAuthCookie } from '@/interfaces/http/oauth-cookie'

/** Browser navigation: redirects to Google / Facebook / TikTok. `?link=` links to the signed-in account instead. */
export const GET = route<{ provider: string }>(
  async ({ params, req }) => {
    const q = req.nextUrl.searchParams
    try {
      const { url, cookie } = await useCases.social.begin(params.provider, { next: q.get('next'), link: q.get('link') })
      return setOAuthCookie(NextResponse.redirect(url, 302), cookie)
    } catch (error) {
      if (!(error instanceof OAuthFlowError)) throw error
      return NextResponse.redirect(useCases.social.failureUrl(error.message), 302)
    }
  },
  { rateLimit: 30, rateLimitKey: 'oauth-start' },
)
