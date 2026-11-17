import { NextResponse } from 'next/server'
import { route } from '@/interfaces/http/handler'
import { useCases } from '@/container'
import { pageViewSchema } from '@/interfaces/http/schemas'

/**
 * Storefront page-view beacon (Back-office → Audience). Neutral name on purpose:
 * ad blockers drop requests to paths like /analytics or /track.
 * Location comes from Vercel's edge geo headers; the IP is only hashed, never stored.
 */
export const POST = route(
  async ({ req, body, ip, user }) => {
    const input = await body(pageViewSchema)
    // The shop owner's own visits (admin session) are not audience.
    if (user?.role !== 'admin') {
      await useCases.audience.recordPageView(input, {
        ip,
        userAgent: req.headers.get('user-agent'),
        country: req.headers.get('x-vercel-ip-country'),
        region: req.headers.get('x-vercel-ip-country-region'),
        city: req.headers.get('x-vercel-ip-city'),
        host: req.nextUrl.hostname,
      })
    }
    return new NextResponse(null, { status: 204 })
  },
  // Generous: many phones share one carrier IP in Côte d'Ivoire.
  { rateLimit: 300, rateLimitKey: 'pulse' },
)
