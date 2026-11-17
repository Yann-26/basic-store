import { NextResponse, type NextRequest } from 'next/server'
import { isAllowedOrigin } from '@/interfaces/http/origins'

/**
 * Edge middleware: CORS + security headers for every API response.
 * Business rules (auth, CSRF, rate limits, captcha) live in the route wrapper.
 *
 * Sessions are cookies, so CORS is credentialed: only allow-listed origins
 * (the shop, ALLOWED_ORIGINS, localhost in development) get CORS headers;
 * any other origin gets none and the browser blocks the response.
 */
function corsHeaders(origin: string | null): Record<string, string> {
  if (!isAllowedOrigin(origin)) return { Vary: 'Origin' }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Recaptcha-Token',
    'Access-Control-Expose-Headers': 'X-Request-Id',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

const securityHeaders: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
}

export default function middleware(request: NextRequest) {
  const headers = { ...corsHeaders(request.headers.get('origin')), ...securityHeaders }

  if (request.method === 'OPTIONS') return new NextResponse(null, { status: 204, headers })

  const response = NextResponse.next()
  for (const [key, value] of Object.entries(headers)) response.headers.set(key, value)
  return response
}

export const config = { matcher: '/api/:path*' }
